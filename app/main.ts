import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});



  // rl.question("$ ", (answer) => {
  //   console.log(`${answer}: command not found`)
  //   rl.close();
  // });
  rl.setPrompt("$ ")
  rl.prompt()
  rl.on('line', (line)=>{
    
    if (line==="exit"){
      return rl.close();
    }
    if (line.startsWith("echo ")){
        console.log(line.slice(5))
        rl.prompt()
        return
    }
    console.log(`${line}: command not found`)
  rl.prompt()
  })

