const path = require('path');
const fs = require('fs');
const { cwd, changeFileSync, exec } = require('./util');
const readlineSync = require('readline-sync');

const name = readlineSync.question('请输入包名：\n').trim();
const targetPath = cwd(`./packages/${name}`);
if (fs.existsSync(targetPath)) {
  return console.log(`${name} 已存在`);
}
const description = readlineSync.question('\n请输入描述：\n').trim();

const tempPath = cwd('./packages/temp');

exec(`cp -r ${tempPath} ${targetPath}`);

function replaceTemp(data) {
  return data.replace(/(__name__)|(__description__)/g, match => {
    return match === '__name__' ? name : description;
  });
}

changeFileSync(path.resolve(targetPath, `./README.md`), replaceTemp);
changeFileSync(path.resolve(targetPath, `./package.json`), data => {
  const v = replaceTemp(data);
  return v.replace(/"private": true/g, '"private": false');
});

console.log(`${name} 创建成功! 🤡`);
