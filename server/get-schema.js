require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data, error } = await supabase.rpc('get_columns', { table_name: 'Garage' });
  if (error) {
    // Fallback: try to just select 1 row
    const res = await supabase.from('Garage').select('*').limit(1);
    console.log(Object.keys(res.data[0] || {}));
  } else {
    console.log(data);
  }
}
main();
