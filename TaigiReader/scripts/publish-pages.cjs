const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
const web=path.join(root,'dist/web');
const run=(args,opts={})=>execFileSync('git',args,{cwd:repo,encoding:'utf8',...opts}).trim();
if(!fs.existsSync(path.join(web,'index.html')))throw Error('Run pnpm build:web first.');
const gitDir=run(['rev-parse','--absolute-git-dir']);
const env={...process.env,GIT_INDEX_FILE:path.join(root,'dist/pages-index')};
const git=args=>run(['--git-dir='+gitDir,'--work-tree='+web,...args],{env});
git(['read-tree','--empty']);git(['add','--all','--force']);
const tree=git(['write-tree']);let parent=[];
try{parent=['-p',run(['rev-parse','refs/heads/gh-pages'])];}catch{}
const commit=run(['commit-tree',tree,...parent,'-m','Publish Taigi Reader website']);
run(['update-ref','refs/heads/gh-pages',commit]);
if(!process.argv.includes('--prepare'))console.log(run(['push','origin','gh-pages']));console.log('Pages branch: '+commit);

