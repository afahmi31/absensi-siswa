// Fixed trusted worker program. No source path, uploaded code, or eval from user input.
// Isolated heap and a terminating parent deadline bound synchronous XML/ExcelJS work.
export const ROSTER_WORKER = String.raw`
const {parentPort,workerData}=require('node:worker_threads');
const {crc32}=require('node:zlib');
const yauzl=require(workerData.modules.yauzl);
const {SaxesParser}=require(workerData.modules.saxes);
const ExcelJS=require(workerData.modules.exceljs);
const fail=()=>{throw new Error('invalid-workbook')};
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS='http://schemas.openxmlformats.org/package/2006/relationships';
const CNS='http://schemas.openxmlformats.org/package/2006/content-types';
const OR='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const allowedParts=/^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core)\.xml|xl\/(?:workbook\.xml|styles\.xml|sharedStrings\.xml|theme\/theme1\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet1\.xml))$/;
const sheetTags=new Set('worksheet sheetPr outlinePr pageSetUpPr dimension sheetViews sheetView pane selection sheetFormatPr cols col sheetData row c v is t phoneticPr sheetProtection autoFilter sortState sortCondition printOptions pageMargins pageSetup headerFooter oddHeader oddFooter evenHeader evenFooter firstHeader firstFooter rowBreaks colBreaks brk'.split(' '));
function xmlGuard(name,bytes){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const parser=new SaxesParser({xmlns:true}); let depth=0,nodes=0,sheets=0,root='',rows=0,currentRow=0,cellCount=0;let cells=new Set();const relationIds=new Set();
 const attr=(tag,key)=>{const a=Object.values(tag.attributes).find(a=>a.local===key && !a.uri);return a?a.value:''};
 parser.on('doctype',fail);parser.on('error',fail);
 parser.on('xmldecl',d=>{if(d.encoding&&!/^utf-8$/i.test(d.encoding))fail()});
 parser.on('opentag',tag=>{
  if(++depth>64||++nodes>100000||Object.keys(tag.attributes).length>40)fail();
  for(const a of Object.values(tag.attributes))if(a.value.length>16384)fail();
  if(!root){root=tag.local;if(name==='xl/worksheets/sheet1.xml'&&(root!=='worksheet'||tag.uri!==NS))fail();if(name==='xl/workbook.xml'&&(root!=='workbook'||tag.uri!==NS))fail();if(name.endsWith('.rels')&&(root!=='Relationships'||tag.uri!==RNS))fail();if(name==='[Content_Types].xml'&&(root!=='Types'||tag.uri!==CNS))fail()}
  if(['f','cfRule','drawing','legacyDrawing','oleObject','picture','externalReference','AlternateContent'].includes(tag.local)||(tag.local==='extLst'&&!['xl/theme/theme1.xml','xl/styles.xml'].includes(name)))fail();
  if(name==='xl/worksheets/sheet1.xml'){
   if(tag.uri!==NS||!sheetTags.has(tag.local))fail();
   if(tag.local==='row'){const r=Number(attr(tag,'r'));if(!Number.isInteger(r)||r<1||r>501||r<=currentRow||++rows>501)fail();currentRow=r;cellCount=0;cells=new Set()}
   if(tag.local==='c'){const ref=attr(tag,'r');if(!/^[A-E][1-9][0-9]{0,2}$/.test(ref)||Number(ref.slice(1))!==currentRow||++cellCount>5||cells.has(ref))fail();cells.add(ref);const type=attr(tag,'t');if(!['','s','str','inlineStr','n','b','e','d'].includes(type))fail()}
   if(tag.local==='dimension'){const ref=attr(tag,'ref');const ends=ref.split(':');if(ends.some(r=>!(/^[A-E][1-9][0-9]{0,2}$/.test(r))||Number(r.slice(1))>501))fail()}
  }
  if(name==='xl/workbook.xml'&&tag.local==='sheet'){if(tag.uri!==NS||++sheets>1||!['','visible'].includes(attr(tag,'state')))fail()}
  if(name.endsWith('.rels')&&tag.local==='Relationship'){
   const id=attr(tag,'Id');if(!id||relationIds.has(id))fail();relationIds.add(id);
   if(tag.uri!==RNS||attr(tag,'TargetMode'))fail();
   const target=attr(tag,'Target'),type=attr(tag,'Type');
   const types=new Set([OR+'officeDocument',OR+'worksheet',OR+'styles',OR+'sharedStrings',OR+'theme',OR+'extended-properties','http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties']);
   if(!types.has(type)||!target||target.includes('..')||target.includes('\\')||target.startsWith('/')||target.includes(':'))fail();
   const resolved=name==='_rels/.rels'?target:'xl/'+target;if(!allowedParts.test(resolved))fail();
  }
  if(name==='[Content_Types].xml'&&['Override','Default'].includes(tag.local)){
   const content=attr(tag,'ContentType');
   if(!/^(?:application\/vnd\.openxmlformats-(?:officedocument\.(?:spreadsheetml\.(?:sheet\.main|worksheet|styles|sharedStrings)|theme|extended-properties)|package\.(?:relationships|core-properties))\+xml|application\/xml)$/.test(content)&&!(tag.local==='Default'&&attr(tag,'Extension')==='vml'&&content==='application/vnd.openxmlformats-officedocument.vmlDrawing'))fail();
   const part=attr(tag,'PartName');if(part&&!allowedParts.test(part.replace(/^\//,'')))fail();
  }
 });
 parser.on('text',value=>{if(value.length>1048576)fail()});
 parser.on('closetag',()=>{depth--});parser.write(text).close();
 if(!root||(name==='xl/workbook.xml'&&sheets!==1))fail();
}
(async()=>{
 const input=Buffer.from(workerData.bytes);if(input.length>4194304||input.length<4)fail();
 const zip=await yauzl.fromBufferPromise(input,{strictFileNames:true,validateEntrySizes:true});
 if(zip.entryCount>100)fail();const entries=[],seen=new Set();let declared=0,compressed=0;
 for await(const entry of zip.eachEntry()){
  const name=entry.fileName,key=name.toLowerCase();
  if(entries.length>=100||Buffer.byteLength(name)>240||seen.has(key)||name.includes('\0')||name.includes(':')||name.split('/').some(s=>s==='.'||s==='..')||entry.generalPurposeBitFlag&1||entry.generalPurposeBitFlag&64||! [0,8].includes(entry.compressionMethod)||((entry.externalFileAttributes>>>16)&0xf000)===0xa000)fail();
  seen.add(key);if(name.endsWith('/')){if(entry.uncompressedSize||!['_rels/','docProps/','xl/','xl/_rels/','xl/worksheets/','xl/theme/'].includes(name))fail();continue}if(!allowedParts.test(name))fail();
  if(!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0||entry.uncompressedSize>20971520||entry.uncompressedSize>Math.max(1,entry.compressedSize)*200)fail();
  declared+=entry.uncompressedSize;compressed+=entry.compressedSize;if(declared>20971520||declared>Math.max(1,compressed)*200)fail();entries.push(entry);
 }
 for(const required of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/worksheets/sheet1.xml'])if(!seen.has(required.toLowerCase()))fail();
 let actual=0;
 for(const entry of entries){const stream=await zip.openReadStreamPromise(entry);const chunks=[];let size=0,crc=0;for await(const chunk of stream){size+=chunk.length;actual+=chunk.length;if(actual>20971520||size>entry.uncompressedSize){stream.destroy();fail()}crc=crc32(chunk,crc);chunks.push(chunk)}if(size!==entry.uncompressedSize||crc!==entry.crc32)fail();xmlGuard(entry.fileName,Buffer.concat(chunks))}
 const book=new ExcelJS.Workbook();await book.xlsx.load(input);if(book.worksheets.length!==1)fail();const sheet=book.worksheets[0];if(sheet.rowCount>501||sheet.columnCount>5||sheet.getImages().length)fail();
 const headers=['Nama','NIPD','Jenis Kelamin','Tanggal Masuk','Tanggal Keluar'];for(let c=1;c<=5;c++)if(sheet.getRow(1).getCell(c).value!==headers[c-1])fail();
 const result=[];for(let r=2;r<=sheet.rowCount;r++){
  const row=sheet.getRow(r),values=[],errors=[];let populated=false;
  for(let c=1;c<=5;c++){const v=row.getCell(c).value;if(v!==null&&v!==undefined&&v!=='')populated=true;if(v===null||v===undefined)values.push('');else if(typeof v==='string'){if(v.length>2048)fail();values.push(v)}else{values.push('');errors.push(headers[c-1]+' harus berupa teks sesuai template.')}}
  if(populated)result.push({rowId:r,values,errors,duplicate:false});
 }
 if(!result.length||result.length>500)fail();parentPort.postMessage({rows:result});
})().catch(()=>parentPort.postMessage({error:true}));
`
