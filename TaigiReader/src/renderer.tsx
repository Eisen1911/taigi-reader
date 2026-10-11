import { createRoot } from 'react-dom/client';
import Home from './page';
const root=createRoot(document.getElementById('root')!);
fetch('./series-data.json').then(r=>{if(!r.ok)throw Error('教材尚未匯入');return r.json();}).then(series=>root.render(<Home series={series}/>)).catch(()=>root.render(<main style={{padding:32}}><h1>尚未載入本地教材</h1><p>請先匯入教材，再重新建置 Web 版本。</p></main>));
