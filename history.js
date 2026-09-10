const {createClient}=require("@supabase/supabase-js");
exports.handler=async(event)=>{
 try{
  const auth=event.headers.authorization||event.headers.Authorization;if(!auth) return {statusCode:401,body:JSON.stringify({error:"Login required"})};
  const token=auth.replace(/^Bearer\s+/i,"");
  const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const {data:user,error}=await client.auth.getUser(token);if(error||!user.user)return {statusCode:401,body:JSON.stringify({error:"Invalid session"})};
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const {data,error:dbErr}=await admin.from("nimu_messages").select("role,content,created_at").eq("user_id",user.user.id).order("created_at",{ascending:true}).limit(100);
  if(dbErr)throw dbErr;return {statusCode:200,headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:data||[]})};
 }catch(e){console.error(e);return {statusCode:500,body:JSON.stringify({error:"Could not load memory"})}}
};