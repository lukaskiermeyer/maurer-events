const fs = require('fs');
const path = require('path');

function replaceLink(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceLink(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('import Link from "next/link";')) {
        content = content.replace(/import Link from "next\/link";/g, 'import { Link } from "@/i18n/routing";');
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  });
}

replaceLink('src/app');
replaceLink('src/components');
