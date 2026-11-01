import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
// A fresh non-admin client per login prevents shared auth state between requests.
Deno.serve(createHandler({admin,passwordClient:()=>createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options)}));
