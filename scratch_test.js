import 'dotenv/config';
import { supabase } from './src/config/supabase.js';

async function test() {
  try {
    // Attempt a mock insert with the standard schema columns
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        action: 'test_action',
        metadata: { info: 'test' }
      })
      .select();

    if (error) {
      console.error("Insert failed with columns (action, metadata):", error);
    } else {
      console.log("Insert succeeded!", data);
      
      // Clean up
      if (data && data[0]) {
        await supabase.from('activity_logs').delete().eq('id', data[0].id);
        console.log("Cleanup complete.");
      }
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
