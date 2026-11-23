import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import WebSocket from "ws";
const origin="http://localhost:5173",base=origin+"/api/v1";
async function account(){
  const res=await fetch(base+"/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Feature test",email:randomUUID()+"@example.test",password:randomUUID()})});
  assert.equal(res.status,201);
  const cookie=res.headers.get("set-cookie").split(";")[0];
  const call=(url,options={})=>fetch(base+url,{...options,headers:{Cookie:cookie,...options.headers}});
  const json=async(url,body,method="POST")=>{
    const res=await call(url,body===undefined?{}:{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    assert.ok(res.ok,url+" "+res.status);return res.json();
  };
  return {cookie,call,json};
}
const user=await account(), outsider=await account();
const ws=(await user.json("/workspaces"))[0].id;
const project=await user.json(`/workspaces/${ws}/projects`,{name:"Feature checks",project_key:"CHECK"});
const prefix=`/projects/${project.id}`;
const socket=new WebSocket(base.replace("http:","ws:")+prefix+"/live",{origin,headers:{Cookie:user.cookie}});
function message(){return new Promise((resolve,reject)=>{
  const t=setTimeout(()=>reject(Error("Board notification timed out")),10000);
  socket.once("message",data=>{clearTimeout(t);resolve(String(data))});socket.once("error",reject);
});}
try{
  assert.equal(await message(),"refresh");
  const update=message();
  const issue=await user.json(prefix+"/issues",{title:"Release issue",description:"**Release**",status_id:project.statuses[0].id});
  assert.equal(await update,"refresh");
  const hits=await user.json(`/workspaces/${ws}/search?q=${issue.identifier}`);assert.equal(hits[0].id,issue.id);
  const path=`/issues/${issue.id}/attachments`, form=new FormData();
  form.append("file",new Blob(["release notes"]),"release.txt");
  const uploaded=await user.call(path,{method:"POST",body:form});assert.equal(uploaded.status,201);
  const {id}=await uploaded.json();assert.equal((await user.json(path))[0].id,id);
  const file=await user.call(path+"/"+id);assert.equal(await file.text(),"release notes");assert.match(file.headers.get("content-disposition"),/^attachment/);
  assert.equal((await outsider.call(path+"/"+id)).status,404);
  const days=await user.json(prefix+"/report");assert.equal(days.at(-1).backlog,1);
  await user.json(prefix);await user.json(`/workspaces/${ws}/configuration`);
}finally{socket.close();}
