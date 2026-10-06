import fs from 'node:fs/promises';
const results=JSON.parse(await fs.readFile('test-results/lint-report.json','utf8'));
for(const result of results)for(const message of result.messages)if(message.severity===2&&message.ruleId!=='@typescript-eslint/no-explicit-any')console.log(result.filePath.replace(process.cwd(),''),message.line,message.ruleId,message.message.slice(0,200));
