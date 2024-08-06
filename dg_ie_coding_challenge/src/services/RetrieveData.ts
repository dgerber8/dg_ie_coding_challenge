// A note on my methodology:
//      I was unable to determine how to correctly parse the memory size from the starting download (0x34) service call (which in the case of the sample data, should be 0x2d1bf) so I modified my  
//      approach to work without a known memory size variable. Ideally, this function would retrieve that value and continue reading data from 0x36 calls until the correct number of bytes is read.
//      
//      Below is a summary of the changes in method:
//          - Instead of looking for the initial 0x34 service call, I instead find the first 0x36 call and go from there
//          - Instead of keeping a running count of the total bytes read, I continue reading all data from subsequent 0x36 function calls, ensuring that their BlockSequenceCounters
//            are sequential so that multiple download instances from later potential 0x34 calls wouldn't be combined into one data set.
//          - I continue processing sequential 0x36 calls until EOF. This means that if none are left that correspond with the current 0x34 call, no new data is retrieved before EOF

function processFile(inputFile: File): Promise<number[]> {
    return new Promise((resolve, _reject) => {
        const reader = new FileReader();
        const outputBuffer: number[] = [];

        reader.onload = (event: ProgressEvent<FileReader>) => {

            const arrayBuffer = event.target?.result as ArrayBuffer;
            const bytes = new Uint8Array(arrayBuffer);

            let currIndex = 0;
            let prevBlockSequenceCounter: number | null = null;

            // Loop until there are no bytes left to read (EOF)
            while (currIndex < bytes.length) {
                let serviceCallFound = false;
                let pciLength = 0;
                let bytesWritten = 0;
                let skipNextRow = false;
                let blockSequenceCounter: number | null = null;

                // Evaulate one 17 byte row at a time. This will always be the next 17 bytes because 'bytes' is sliced after each row
                for (let i = currIndex; i < bytes.length; i += 17) {
                    const row = bytes.slice(i, i + 17);

                    // Find the next use of Writing 05 (Service 36). The function id for service 36 will be in that row's 12th byte
                    if (!serviceCallFound && row[11] === 0x36) {

                        // Validate that the blockSequenceCounter is equal to the previous service call's blockSequenceCounter (if one exists).
                        if (prevBlockSequenceCounter === null || row[12] === prevBlockSequenceCounter + 1) {

                            // Extract the PCI length value to determine how many bytes are being read in this service 36 call.
                            const lowerNibble = row[9] & 0x0F;
                            const highByte = row[10];
                            pciLength = ((lowerNibble << 8) | highByte) - 1;

                            // Store the blockSequenceCounter byte to use in the next service 36 search
                            blockSequenceCounter = row[12];
                            prevBlockSequenceCounter = blockSequenceCounter;

                            // Write the data included in the row calling the service (the final 5 bytes)
                            outputBuffer.push(...row.slice(13, 17));
                            bytesWritten += 5;

                            serviceCallFound = true;
                            skipNextRow = true;
                            currIndex = i + 17;
                        }
                    } else if (serviceCallFound && skipNextRow) {
                        // Skip the row directly after the call as it does not contain download data
                        skipNextRow = false;
                        currIndex = i + 17;
                    } else if (serviceCallFound && bytesWritten < pciLength) {
                        // Calculate the remaining bytes needed to reach the given PCI to eliminate padding bytes
                        const remainingBytes = pciLength - bytesWritten;
                        const bytesToAdd = row.slice(10, 17);

                        // If the row includes padding bytes, only read the data before those bytes
                        if (bytesToAdd.length > remainingBytes) {
                            outputBuffer.push(...bytesToAdd.slice(0, remainingBytes));
                            bytesWritten += remainingBytes;
                        } else {
                            outputBuffer.push(...bytesToAdd);
                            bytesWritten += bytesToAdd.length;
                        }

                        currIndex = i + 17;

                        // When bytesWritten reaches the defined PCI length, stop reading this chunk of data and move on to the next service 36 call
                        if (bytesWritten >= pciLength) {
                            break;
                        }
                    }
                }

                // Before reading the service 36, ensure a response (0x76) was sent by the engine computer for the previous service 36 call (with a matching blockSequenceCounter)
                let foundNextIterationStart = false;
                for (let i = currIndex; i < bytes.length; i += 17) {
                    const chunk = bytes.slice(i, i + 17);

                    if (chunk[10] === 0x76 && chunk[11] === blockSequenceCounter) {
                        foundNextIterationStart = true;
                        currIndex = i + 17;
                        break;
                    }
                }

                if (!foundNextIterationStart) {
                    break;
                }
            }

            resolve(outputBuffer);
        };

        reader.onerror = (event: ProgressEvent<FileReader>) => {
            console.error("Error reading file:", event.target?.error);
        };

        reader.readAsArrayBuffer(inputFile);
    });
}

export default processFile