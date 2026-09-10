const OpenAI=require("openai");
const {createClient}=require("@supabase/supabase-js");
exports.handler=async(event)=>{
 if(event.httpMethod!=="POST")return {statusCode:405,body:"Method not allowed"};
 try{
  const body=JSON.parse(event.body||"{}"), messages=Array.isArray(body.messages)?body.messages.slice(-24):[];
  const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  let userId=null, admin=null;
  const auth=event.headers.authorization||event.headers.Authorization;
  if(auth&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY){
    const token=auth.replace(/^Bearer\s+/i,"");
    const userClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    const {data,error}=await userClient.auth.getUser(token);
    if(!error&&data.user){
      userId=data.user.id;
      admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
      const {data:mem}=await admin.from("nimu_messages").select("role,content").eq("user_id",userId).order("created_at",{ascending:false}).limit(30);
      if(mem?.length) messages=[...mem.reverse(),...messages].slice(-40);
    }
  }
  const response=await openai.responses.create({
    model:process.env.OPENAI_MODEL||"gpt-5.6-luna",
    instructions:`You are Nimu, a warm, witty AI companion. You are an AI, never claim to be human. Match the user's language (Bangla/Banglish/English). Be affectionate without encouraging emotional dependency or exclusivity. Keep replies natural and not overly long. You may use remembered conversation context naturally.`,
    input:messages.map(m=>({role:m.role==="assistant"?"assistant":"user",content:[{type:"input_text",text:String(m.content||"")}]})),
    max_output_tokens:600
  });
  const reply=response.output_text||"I'm here 💗";
  if(userId&&admin){
    const lastUser=messages.filter(m=>m.role==="user").at(-1);
    if(lastUser)await admin.from("nimu_messages").insert([{user_id:userId,role:"user",content:lastUser.content},{user_id:userId,role:"assistant",content:reply}]);
  }
  return {statusCode:200,headers:{"Content-Type":"application/json"},body:JSON.stringify({reply})};
 }catch(e){console.error(e);return {statusCode:500,body:JSON.stringify({error:"AI request failed"})}}
};
