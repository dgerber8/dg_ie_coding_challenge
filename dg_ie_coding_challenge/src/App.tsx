import { ChangeEvent, useState } from 'react';
import './App.css';
import processFile from './services/RetrieveData';

function App() {
    const [file, setFile] = useState<File | undefined>();

    // This function triggers on file upload and calls processFile to retrieve the needed transfer data then initiates the download of a file containing that data
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        async function getData(inputFile: File) {
            const outputBuffer = await processFile(inputFile);
            if (outputBuffer.length > 0) {
                // Create a new file from the output buffer
                const blob = new Blob([new Uint8Array(outputBuffer)], { type: "application/octet-stream" });
                const url = URL.createObjectURL(blob);

                // Create a download link and click it to trigger a download
                const a = document.createElement('a');
                a.href = url;
                a.download = 'outputFile.bin';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                console.log("No matching chunk found or no data to write.");
            }
        }

        const inputElement = event.target as HTMLInputElement;
        const inputFile = inputElement.files?.[0];
        setFile(inputFile)

        // Call async function getData to initiate file processing and output download
        if (inputFile) {
            getData(inputFile)
        }
    }

    return (
        <div>
            <h1 id="tableLabel" >Upload a CAN data file and a .bin file containing the transfer data will automatically download</h1>
            {file &&
                (
                    <p>{file.name} </p>
                )
            }
            <input type="file" onChange={handleChange} />
        </div>
    )
}

export default App;