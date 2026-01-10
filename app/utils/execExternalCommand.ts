import { spawn } from "child_process"

export async function execExternalCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject)=>{
        const child = spawn(command, args, {stdio: "inherit", shell: true})
    
        child.on("error", (err) => {
            console.error(`Error executing command: ${err.message}`);
            reject(err);
        });
        child.on("close",(code)=>{
            if (code !== 0) {
                console.error(`Command exited with code ${code}`);
                reject(new Error(`Command exited with code ${code}`)); 
            }else{
                resolve();
            }
        });
    });

        }