import fs from "fs";
import path from "path";

const ROOT = path.resolve("client/src");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  src = src.replace(/\?tenantId=1/g, "");
  src = src.replace(/,\s*tenantId:\s*1(?=\s*[,}])/g, "");
  src = src.replace(/tenantId:\s*1,\s*/g, "");
  src = src.replace(/\{\s*tenantId:\s*1,\s*/g, "{ ");
  src = src.replace(/,\s*tenantId:\s*1\s*\}/g, " }");

  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("patched", path.relative(process.cwd(), file));
  }
}

console.log(`Done — ${changed} file(s) updated.`);
