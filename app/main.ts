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
    console.log(`${line}: command not found`)
  rl.prompt()
  })

