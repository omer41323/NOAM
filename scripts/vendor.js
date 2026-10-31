import { createClient } from '@supabase/supabase-js';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
window.CloudVendor = { createClient, zipSync, unzipSync, strToU8, strFromU8 };

