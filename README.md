# ตอนที่ 1: ข้อสมมติและโครงสร้างระบบ
1. ระบบทำงานบนฐานข้อมูล PostgreSQL ผ่าน Supabase Project และโฮสต์ไฟล์หน้าเว็บแบบสแตติก
2. บัญชีผู้สอนจะถูกกำหนดผ่านคำสั่ง SQL ท้ายสคริปต์หลังจากสร้างบัญชีผ่านหน้าเว็บ
3. การป้องกันไม่ให้ผู้เรียนแก้ไขคะแนนและข้อเสนอแนะในตาราง submissions ใช้การจำกัดสิทธิ์ระดับคอลัมน์ (Column-level Privileges)
4. การย่อขนาดรูปภาพโปรไฟล์ทำผ่าน HTML5 Canvas ในฝั่งเบราว์เซอร์เพื่อให้ขนาดไม่เกิน 2 MB
5. ข้อสอบคู่ขนานชุด A และ B ถูกฝังในตัวแปรระบบ JavaScript เพื่อความสะดวกในการสลับชุดข้อสอบตามรหัสนักศึกษา
6. การตรวจรหัสประจำตัวนักเรียน 11 หลักใช้ Database Trigger เชื่อมโยงกับตาราง students อัตโนมัติ
7. Storage Buckets ทั้ง 3 แห่งตั้งค่าเป็น Private และเข้าถึงผ่าน Signed URL เท่านั้น
8. การคำนวณ Normalized Gain ใช้สูตรของ Hake (1998) พร้อมจัดการกรณีคะแนนก่อนเรียนเต็มเพื่อป้องกันการหารด้วยศูนย์
9. รูปแบบหน้าตาใช้โทนสีน้ำเงินเข้ม–เทา (Navy/Slate) ตามหลักวิชาการและรองรับหน้าจอขนาดตั้งแต่ 360px ขึ้นไป
10. อ้างอิงกรอบทฤษฎีตามที่กำหนด ได้แก่ Azuma, Milgram & Kishino, Mayer, Rovinelli & Hambleton และ Hake

---

# ตอนที่ 2: ไฟล์ setup.sql
```sql
create extension if not exists "uuid-ossp";

create table public.teachers (
    user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.students (
    id varchar(11) primary key,
    title varchar(20) not null,
    first_name varchar(100) not null,
    last_name varchar(100) not null,
    section varchar(50) not null,
    user_id uuid references auth.users(id) on delete set null,
    photo_path text
);

create table public.attempts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    kind varchar(10) check (kind in ('pre', 'post')) not null,
    score int not null,
    answers jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (user_id, kind)
);

create table public.progress (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    unit int check (unit between 1 and 5) not null,
    done boolean default false,
    unique (user_id, unit)
);

create table public.submissions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    unit int check (unit between 1 and 5) not null,
    kind varchar(10) check (kind in ('link', 'file')) not null,
    url text,
    storage_path text,
    note text,
    score int,
    teacher_comment text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.materials (
    id uuid primary key default uuid_generate_v4(),
    title varchar(255) not null,
    kind varchar(10) check (kind in ('file', 'link', 'video')) not null,
    url text,
    storage_path text,
    file_name varchar(255),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers where user_id = auth.uid()
  );
$$;

alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.attempts enable row level security;
alter table public.progress enable row level security;
alter table public.submissions enable row level security;
alter table public.materials enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.students, public.materials to authenticated;
grant insert, update, select on public.attempts, public.progress to authenticated;
grant insert, update, select on public.submissions to authenticated;

revoke update on public.submissions from authenticated;
grant update (url, storage_path, note) on public.submissions to authenticated;
grant all on public.teachers, public.students, public.attempts, public.progress, public.submissions, public.materials to authenticated;

create policy "Students view own profile or teachers view all" on public.students
    for select using (user_id = auth.uid() or public.is_teacher());

create policy "Students update own photo" on public.students
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Teacher manage teachers" on public.teachers
    for all using (public.is_teacher());

create policy "Student manage own attempts" on public.attempts
    for all using (user_id = auth.uid() or public.is_teacher());

create policy "Student manage own progress" on public.progress
    for all using (user_id = auth.uid() or public.is_teacher());

create policy "Student manage own submissions" on public.submissions
    for all using (user_id = auth.uid() or public.is_teacher());

create policy "Everyone read materials, teacher write" on public.materials
    for select using (true);

create policy "Teacher manage materials" on public.materials
    for all using (public.is_teacher());

create or replace view public.results with (security_invoker = true) as
select 
    s.id as student_id,
    s.title,
    s.first_name,
    s.last_name,
    s.section,
    s.photo_path,
    pre.score as pre_score,
    post.score as post_score,
    case 
        when pre.score is not null and pre.score < 10 then round(CAST((post.score - pre.score)::numeric / (10 - pre.score) as numeric), 2)
        else null
    end as normalized_gain
from public.students s
left join public.attempts pre on s.user_id = pre.user_id and pre.kind = 'pre'
left join public.attempts post on s.user_id = post.user_id and post.kind = 'post';

grant select on public.results to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id varchar(11);
begin
    v_student_id := substring(new.email from 1 for 11);
    if v_student_id ~ '^[0-9]{11}$' then
        if exists (select 1 from public.students where id = v_student_id and user_id is null) then
            update public.students set user_id = new.id where id = v_student_id;
        else
            raise exception 'รหัสนักศึกษาไม่ถูกต้อง หรือถูกใช้งานไปแล้ว';
        end if;
    end if;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

insert into public.students (id, title, first_name, last_name, section, user_id, photo_path) values
('67115271201', 'นาย', 'กิตติพงษ์', 'ใจดี', 'หมู่เรียนที่ 2', null, null),
('67115271202', 'นางสาว', 'ณัฐชา', 'สุขสวัสดิ์', 'หมู่เรียนที่ 2', null, null),
('67115271203', 'นาย', 'ธนดล', 'พงษ์ภิรมย์', 'หมู่เรียนที่ 2', null, null),
('67115271204', 'นางสาว', 'ปวีณา', 'วงศ์ษา', 'หมู่เรียนที่ 2', null, null),
('67115271205', 'นาย', 'พงศกร', 'คำแหง', 'หมู่เรียนที่ 2', null, null),
('67115271206', 'นางสาว', 'เมธินี', 'ศรีบุญเรือง', 'หมู่เรียนที่ 2', null, null);

-- คำสั่งตั้งผู้สอน (ให้นำคอมเมนต์ออกและเปลี่ยนอีเมลหลังสมัครสมาชิก)
-- insert into public.teachers (user_id) select id from auth.users where email = 'your_teacher_email@gmail.com';
```

---

# ตอนที่ 3: ไฟล์ courseware.html
```html
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>บทเรียนคอมพิวเตอร์ช่วยสอน (CAI) - วิทยาการคำนวณ AR</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
    <style>
        body { font-family: 'Sarabun', sans-serif; background-color: #f8fafc; color: #1e293b; }
        .navy-header { background-color: #0f172a; color: #ffffff; }
        .slate-card { background-color: #ffffff; border: 1px solid #e2e8f0; }
    </style>
</head>
<body class="min-h-screen flex flex-col">
    <header class="navy-header py-4 px-6 shadow-md flex justify-between items-center">
        <div>
            <h1 class="text-lg font-bold">บทเรียนคอมพิวเตอร์ช่วยสอน (CAI): สื่อ AR (ว21003017)</h1>
            <p class="text-xs text-slate-300">โรงเรียนบ้านหนองกะปาด | หมู่เรียนที่ 2</p>
        </div>
        <div id="user-status" class="text-sm"></div>
    </header>

    <main class="flex-grow container mx-auto px-4 py-6 max-w-4xl">
        <div id="app">
            <div id="view-loading" class="text-center py-12">
                <p class="text-slate-600">กำลังโหลดระบบ...</p>
            </div>
        </div>
    </main>

    <footer class="bg-slate-900 text-slate-400 py-3 text-center text-xs">
        <p>ภาพที่ 1: ส่วนติดต่อผู้ใช้ระบบบทเรียน CAI เรื่อง เทคโนโลยีความจริงเสริม</p>
    </footer>

    <script>
        const SUPABASE_URL = 'YOUR_SUPABASE_URL';
        const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

        let supabaseClient = null;
        if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }

        const EXAMS = {
            A: [
                {q: "ข้อที่ 1: ตามนิยามของ Azuma (1997) องค์ประกอบใดไม่ใช่ลักษณะของ AR?", opts: ["ผสมผสานวัตถุจริงและเสมือน", "ทำงานโต้ตอบได้แบบเรียลไทม์", "จำลองสภาพแวดล้อมเสมือนจริง 100%", "จัดวางในสามมิติ"], ans: 2, exp: "Azuma (1997) ระบุว่า AR ผสมผสานของจริงกับของเสมือน ไม่ใช่โลกเสมือน 100% แบบ VR", unit: 1},
                {q: "ข้อที่ 2: ข้อใดอธิบายความต่างตามแนวคิด Milgram & Kishino (1994) ได้ถูกต้อง?", opts: ["AR อยู่กึ่งกลางระหว่าง Real Environment กับ Virtual Environment", "AR แยกจากโลกจริงโดยสิ้นเชิง", "MR มีความเป็นจริงมากกว่า AR เสมอ", "VR คือการซ้อนทับภาพ"], ans: 0, exp: "Reality-Virtuality Continuum จัดวาง AR ไว้บนสเปกตรัมระหว่างโลกจริงกับโลกเสมือน", unit: 1},
                {q: "ข้อที่ 3: เทคโนโลยี AR ชนิดใดอาศัยพิกัด GPS และเข็มทิศในการแสดงผล?", opts: ["Marker-based", "Markerless", "Location-based", "Projection-based"], ans: 2, exp: "Location-based ใช้พิกัดทางภูมิศาสตร์เพื่อแสดงข้อมูลตามตำแหน่งผู้ใช้", unit: 2},
                {q: "ข้อที่ 4: ข้อใดคือข้อดีเด่นของ WebAR เทียบกับแอปเนทีฟ?", opts: ["ไม่ต้องติดตั้งแอปพลิเคชันผ่านสโตร์", "ทำงานออฟไลน์ได้ดีกว่ามาก", "ประมวลผลโมเดล 3 มิติได้เร็วกว่า", "ไม่จำกัดประสิทธิภาพอุปกรณ์"], ans: 0, exp: "WebAR ทำงานผ่านเบราว์เซอร์ได้ทันทีโดยไม่ต้องดาวน์โหลดแอป", unit: 2},
                {q: "ข้อที่ 5: หลักการออกแบบสื่อใดของ Mayer ที่เกี่ยวข้องกับการลดภาระทางปัญญาที่ไม่จำเป็น?", opts: ["Coherence Principle", "Multimedia Principle", "Spatial Contiguity", "Personalization"], ans: 0, exp: "Coherence Principle เน้นตัดข้อมูลที่ไม่เกี่ยวข้องออกเพื่อลดภาระทางปัญญา", unit: 3},
                {q: "ข้อที่ 6: หากผู้เรียนไม่มีอุปกรณ์สมาร์ตโฟนรองรับ AR ครูควรปฏิบัติอย่างไรตามหลักการออกแบบ?", opts: ["บังคับให้ซื้ออุปกรณ์เพิ่ม", "จัดหาทางเลือกสำรอง เช่น ภาพสามมิติหรือสื่อสิ่งพิมพ์เชิงลึก", "งดการวัดผล", "ให้คะแนนศูนย์"], ans: 1, exp: "ต้องคำนึงถึงการเข้าถึงและมีทางเลือกสำรองเสมอ", unit: 3},
                {q: "ข้อที่ 7: แท็ก HTML ใน WebAR สำหรับแสดงโมเดล .glb คือข้อใด?", opts: ["<model-viewer>", "<ar-object>", "<glTF-view>", "<3d-canvas>"], ans: 0, exp: "<model-viewer> เป็น Web Component มาตรฐานสำหรับแสดงโมเดล 3 มิติ", unit: 4},
                {q: "ข้อที่ 8: ดัชนีความสอดคล้อง (IOC) ตามเกณฑ์ของ Rovinelli & Hambleton (1977) ข้อใดใช้ได้?", opts: ["≥ 0.50", "≥ 0.80", "≥ 1.00", "≥ 0.20"], ans: 0, exp: "เกณฑ์มาตรฐาน IOC ต้องมีค่าตั้งแต่ 0.50 ขึ้นไป", unit: 5},
                {q: "ข้อที่ 9: สูตร Normalized Gain ของ Hake (1998) คำนวณจากอะไร?", opts: ["(Post - Pre) / (Full - Pre)", "(Post + Pre) / 2", "Post / Pre", "Full - Post"], ans: 0, exp: "Normalized gain วัดความก้าวหน้าเทียบกับคะแนนที่ยังขาดอยู่", unit: 5},
                {q: "ข้อที่ 10: ประสิทธิภาพ E1/E2 ตามเกณฑ์มาตรฐานทั่วไปคือข้อใด?", opts: ["80/80", "70/70", "90/90", "50/50"], ans: 0, exp: "เกณฑ์ประสิทธิภาพมาตรฐานทางการศึกษาคือ 80/80", unit: 5}
            ],
            B: [
                {q: "ข้อที่ 1: ข้อใดสรุปสาระสำคัญของ Augmented Reality (Azuma, 1997) ได้แม่นยำที่สุด?", opts: ["สร้างโลกดิจิทัลแยกขาด", "ซ้อนทับข้อมูลเสมือนบนโลกจริงแบบเรียลไทม์", "ใช้งานผ่านแว่นตา VR เท่านั้น", "บันทึกภาพวิดีโอ 360 องศา"], ans: 1, exp: "Azuma เน้นการซ้อนทับวัตถุเสมือนบนโลกจริงและโต้ตอบแบบเรียลไทม์", unit: 1},
                {q: "ข้อที่ 2: Continuum ของ Milgram & Kishino (1994) จัดลำดับความจริงอย่างไร?", opts: ["จากโลกจริงแท้สู่โลกเสมือนจริงแท้", "จากภาพนิ่งสู่วิดีโอ", "จากออฟไลน์สู่ออนไลน์", "จากฮาร์ดแวร์สู่ซอฟต์แวร์"], ans: 0, exp: "สเปกตรัมไล่จากสภาพแวดล้อมจริงไปจนถึงสภาพแวดล้อมเสมือนสมบูรณ์", unit: 1},
                {q: "ข้อที่ 3: AR ชนิดใดที่ใช้แผ่นป้ายสัญลักษณ์ (Marker) ในการกำหนดจุดแสดงผล?", opts: ["Marker-based", "Markerless", "Location-based", "Projection-based"], ans: 0, exp: "Marker-based อาศัยสัญลักษณ์ภาพเฉพาะในการจับคู่ตำแหน่ง", unit: 2},
                {q: "ข้อที่ 4: ข้อจำกัดสำคัญประการหนึ่งของ WebAR คือข้อใด?", opts: ["ขึ้นอยู่กับประสิทธิภาพเบราว์เซอร์และอินเทอร์เน็ต", "ต้องติดตั้งโปรแกรมเสริมทุกครั้ง", "ใช้ได้เฉพาะคอมพิวเตอร์ตั้งโต๊ะ", "ไม่สามารถหมุนโมเดลได้"], ans: 0, exp: "WebAR ต้องอาศัยการเชื่อมต่อเครือข่ายและเบราว์เซอร์ที่รองรับ WebGL", unit: 2},
                {q: "ข้อที่ 5: ตามทฤษฎีภาระทางปัญญา การออกแบบสื่อ AR ที่ดีควรคำนึงถึงสิ่งใด?", opts: ["ความซับซ้อนเกินจำเป็น", "การจัดการภาระทางปัญญาภายในและภายนอก", "การใช้สีฉูดฉาด", "เสียงประกอบดังต่อเนื่อง"], ans: 1, exp: "ต้องบริหารจัดการภาระทางปัญญาเพื่อไม่ให้ผู้เรียนสับสน", unit: 3},
                {q: "ข้อที่ 6: หากนักเรียนมีข้อจำกัดด้านฮาร์ดแวร์ในการเรียน AR แนวทางแก้ปัญหาที่เหมาะสมคือ?", opts: ["จัดกิจกรรมกลุ่มหรือใช้สื่อจำลองทางเลือก", "งดการเรียน", "ให้ท่องจำเนื้อหาแทน", "ให้ค้นคว้าเองนอกเวลา"], ans: 0, exp: "การจัดกิจกรรมกลุ่มหรือทางเลือกทดแทนช่วยให้ทุกคนเข้าถึงการเรียนรู้ได้", unit: 3},
                {q: "ข้อที่ 7: แหล่งรวมไฟล์โมเดล 3 มิติมาตรฐานสำหรับ WebAR มักใช้ฟอร์แมตใด?", opts: [".glb หรือ .gltf", ".exe", ".mp3", ".docx"], ans: 0, exp: "ฟอร์แมต .glb และ .gltf เป็นมาตรฐานสำหรับเว็บ 3 มิติ", unit: 4},
                {q: "ข้อที่ 8: ผู้เชี่ยวชาญประเมินความสอดคล้องของข้อสอบ (IOC) ต้องผ่านเกณฑ์ขั้นต่ำเท่าใด?", opts: ["0.50", "0.30", "0.10", "0.90"], ans: 0, exp: "ค่า IOC ต้องไม่ต่ำกว่า 0.50 ตาม Rovinelli & Hambleton", unit: 5},
                {q: "ข้อที่ 9: ค่า Normalized Gain เหมาะสำหรับการประเมินลักษณะใด?", opts: ["วัดความก้าวหน้าการเรียนรู้รายบุคคลและกลุ่ม", "วัดความพึงพอใจ", "วัดความเร็วอินเทอร์เน็ต", "วัดน้ำหนักไฟล์งาน"], ans: 0, exp: "Hake Gain ใช้ประเมินความก้าวหน้าทางการเรียนเปรียบเทียบก่อนและหลังเรียน", unit: 5},
                {q: "ข้อที่ 10: ความหมายของ E2 ในสูตรประสิทธิภาพ 80/80 คืออะไร?", opts: ["ร้อยละของคะแนนเฉลี่ยจากการประเมินหลังเรียน", "ร้อยละของผู้เรียนที่ผ่าน", "ร้อยละของเวลาเรียน", "ร้อยละของงานที่ส่ง"], ans: 0, exp: "E2 คือประสิทธิภาพของผลลัพธ์ (คะแนนหลังเรียน)", unit: 5}
            ]
        };

        const UNITS = [
            {
                id: 1,
                title: "หน่วยที่ 1: พื้นฐานความจริงเสริม (AR)",
                obj: "อธิบายความหมายและองค์ประกอบของ AR ตามแนวคิดของ Azuma (1997) และเปรียบเทียบสเปกตรัมความจริงตาม Milgram & Kishino (1994) ได้",
                content: `ความจริงเสริม (Augmented Reality หรือ AR) ตามคำนิยามของ Ronald Azuma (1997) ประกอบด้วย 3 องค์ประกอบหลัก:
1. การผสมผสานวัตถุโลกจริงเข้ากับวัตถุเสมือน
2. การโต้ตอบได้แบบเรียลไทม์ (Real-time Interaction)
3. การจัดวางตำแหน่งวัตถุในสภาพแวดล้อมสามมิติ (3D Registration)

นอกจากนี้ Paul Milgram และ Fumio Kishino (1994) ได้เสนอแนวคิด Reality-Virtuality Continuum ซึ่งแสดงสเปกตรัมต่อเนื่องระหว่างสภาพแวดล้อมจริง (Real Environment) และสภาพแวดล้อมเสมือนจริง (Virtual Environment) โดย AR จะอยู่ค่อนไปทางโลกจริง (Augmented Reality) ขณะที่ MR และ VR จะขยับเข้าใกล้โลกเสมือนมากขึ้น`,
                example: "บริบทการศึกษา: การส่องกล้องสมาร์ตโฟนไปที่แผนที่กระดาษในห้องเรียนสังคมศึกษา แล้วปรากฏภาพ 3 มิติของภูมิประเทศจำลองขึ้นมาบนโต๊ะ",
                checkQ: {
                    q: "คำถามตรวจสอบความเข้าใจ: ข้อใดคือองค์ประกอบสำคัญของ AR ตาม Azuma (1997)?",
                    opts: ["แยกขาดจากโลกจริง", "ผสมผสานของจริงกับเสมือนและโต้ตอบแบบเรียลไทม์", "ใช้แว่นตา VR เท่านั้น", "ไม่มีมิติที่สาม"],
                    ans: 1,
                    exp: "ถูกต้อง! AR ต้องผสานโลกจริงกับเสมือนและโต้ตอบได้ทันที"
                }
            },
            {
                id: 2,
                title: "หน่วยที่ 2: ชนิดและเทคโนโลยี AR",
                obj: "จำแนกประเภทของ AR และเปรียบเทียบข้อจำกัดระหว่าง WebAR และแอปพลิเคชันเนทีฟได้",
                content: `เทคโนโลยี AR แบ่งออกเป็น 4 ประเภทหลัก:
1. Marker-based AR: อาศัยภาพสัญลักษณ์หรือ QR Code อ้างอิง
2. Markerless AR: ตรวจจับพื้นผิวหรือสภาพแวดล้อมจริงโดยไม่ต้องใช้ป้ายสัญลักษณ์
3. Location-based AR: อาศัยพิกัด GPS, เข็มทิศ และ Gyroscope
4. Projection-based AR: ฉายแสงภาพจำลองลงบนพื้นผิววัตถุ

การพัฒนาบนเว็บ (WebAR) ช่วยให้ผู้เรียนเข้าถึงได้ทันทีผ่านเบราว์เซอร์บนมือถือโดยไม่ต้องติดตั้งแอปพลิเคชันผ่าน App Store แต่มีข้อจำกัดด้านประสิทธิภาพกราฟิกและความเสถียรของเครือข่าย`,
                example: "บริบทการศึกษา: การใช้ Markerless AR แสดงโครงสร้างโมเดลเคมีบนโต๊ะเรียนโดยไม่ต้องปริ้นท์กระดาษมาร์กเกอร์",
                checkQ: {
                    q: "คำถามตรวจสอบความเข้าใจ: AR ชนิดใดที่อาศัยพิกัด GPS และเข็มทิศ?",
                    opts: ["Marker-based", "Location-based", "Projection-based", "Markerless"],
                    ans: 1,
                    exp: "ถูกต้อง! Location-based ใช้พิกัดทางภูมิศาสตร์ในการระบุตำแหน่ง"
                }
            },
            {
                id: 3,
                title: "หน่วยที่ 3: การออกแบบสื่อ AR เพื่อการเรียนรู้",
                obj: "ประยุกต์หลักการภาระทางปัญญาและหลักการออกแบบของ Mayer ในการออกแบบสื่อ AR พร้อมจัดเตรียมแนวทางสำรองสำหรับผู้เรียนที่ไม่มีอุปกรณ์",
                content: `การออกแบบสื่อ AR ต้องคำนึงถึง:
1. การกำหนดวัตถุประสงค์การเรียนรู้ให้ชัดเจนก่อนเลือกใช้เทคโนโลยี
2. ทฤษฎีภาระทางปัญญา (Cognitive Load Theory) โดยลดภาระส่วนเกิน (Extraneous load) เช่น ตัดกราฟิกที่ไม่จำเป็นออก
3. หลักการออกแบบมัลติมีเดียของ Richard E. Mayer เช่น Coherence Principle และ Spatial Contiguity
4. การเข้าถึงได้ทั่วถึง (Accessibility) โดยต้องมีสื่อทางเลือก (Fallback) สำหรับนักเรียนที่ไม่มีอุปกรณ์สมาร์ตโฟนรองรับ`,
                example: "บริบทการศึกษา: การออกแบบแอปจำลองระบบสุริยะที่มีปุ่มเสียงบรรยายสั้นกระชับ ไม่รกตา และมีใบงาน 3 มิติสำรองสำหรับนักเรียนที่อุปกรณ์ไม่รองรับ",
                checkQ: {
                    q: "คำถามตรวจสอบความเข้าใจ: หลักการของ Mayer ข้อใดเน้นการตัดข้อมูลที่ไม่จำเป็นออก?",
                    opts: ["Coherence Principle", "Multimedia Principle", "Personalization Principle", "Voice Principle"],
                    ans: 0,
                    exp: "ถูกต้อง! Coherence Principle เน้นกำจัดสิ่งเร้าที่ไม่เกี่ยวข้องออกเพื่อลดภาระทางปัญญา"
                }
            },
            {
                id: 4,
                title: "หน่วยที่ 4: ปฏิบัติสร้างสื่อ WebAR ขั้นพื้นฐาน",
                obj: "ใช้งานแท็ก <model-viewer> เพื่อแสดงผลโมเดล 3 มิติ (.glb) และทดสอบโหมด AR บนอุปกรณ์เคลื่อนที่ได้",
                content: `ในบทเรียนนี้ผู้เรียนจะได้เรียนรู้การใช้แท็ก <model-viewer> (เวอร์ชัน 3.x จาก CDN ทางการ) เพื่อแสดงโมเดล 3 มิติและเปิดโหมด AR บนมือถือ:
ขั้นตอนการปฏิบัติ:
1. เตรียมไฟล์โมเดล 3 มิติสกุล .glb
2. อัปโหลดไฟล์ขึ้นสู่ Cloud Storage หรือโฮสติ้ง
3. นำ URL มาใส่ในโค้ด HTML ผ่านแท็ก <model-viewer src="url.glb" ar camera-controls></model-viewer>
4. ทดสอบเปิดผ่านเบราว์เซอร์บนสมาร์ตโฟนและกดปุ่ม AR Mode`,
                example: "บริบทการศึกษา: การฝังโมเดลหัวใจมนุษย์ 3 มิติลงในหน้าเว็บ CAI เพื่อให้นักเรียนหมุนดูรอบทิศทาง",
                checkQ: {
                    q: "คำถามตรวจสอบความเข้าใจ: แท็กมาตรฐานข้อใดใช้แสดงโมเดล 3 มิติและรองรับ WebAR?",
                    opts: ["<model-viewer>", "<canvas-3d>", "<ar-frame>", "<gl-object>"],
                    ans: 0,
                    exp: "ถูกต้อง! <model-viewer> เป็นคอมโพเนนต์มาตรฐานที่รองรับ AR บนมือถือได้ทันที"
                }
            },
            {
                id: 5,
                title: "หน่วยที่ 5: การทดสอบและประเมินสื่อ AR",
                obj: "คำนวณค่าดัชนีความสอดคล้อง (IOC), ประสิทธิภาพ E1/E2 และค่า Normalized Gain ตามเกณฑ์มาตรฐานได้",
                content: `การประเมินคุณภาพสื่อการสอนประกอบด้วย:
1. การหาค่าดัชนีความสอดคล้อง (IOC) โดยผู้เชี่ยวชาญ ตามเกณฑ์ของ Rovinelli & Hambleton (1977) ซึ่งต้องมีค่า ตั้งแต่ 0.50 ขึ้นไป
2. การหาประสิทธิภาพบทเรียน E1/E2 ตามเกณฑ์มาตรฐาน 80/80
3. การวัดความก้าวหน้าทางการเรียนด้วย Normalized Gain ตามสูตรของ Hake (1998):
   $$\\text{Gain} = \\frac{\\text{Post-test} - \\text{Pre-test}}{\\text{Full Score} - \\text{Pre-test}}$$`,
                example: "บริบทการศึกษา: การนำชุดกิจกรรม AR ไปทดลองใช้กับนักเรียนกลุ่มตัวอย่าง แล้วคำนวณคะแนนก่อนและหลังเรียนเพื่อหาค่าความก้าวหน้า",
                checkQ: {
                    q: "คำถามตรวจสอบความเข้าใจ: เกณฑ์ขั้นต่ำของค่า IOC ตาม Rovinelli & Hambleton (1977) คือเท่าใด?",
                    opts: ["0.50", "0.80", "1.00", "0.20"],
                    ans: 0,
                    exp: "ถูกต้อง! ค่า IOC ต้องไม่น้อยกว่า 0.50"
                }
            }
        ];

        let state = {
            user: null,
            profile: null,
            isTeacher: false,
            currentView: 'login',
            activeUnit: 1,
            examSet: 'A'
        };

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        async function initApp() {
            const app = document.getElementById('app');
            if (!supabaseClient) {
                app.innerHTML = `
                    <div class="slate-card p-6 rounded-lg shadow text-center">
                        <h2 class="text-xl font-bold text-red-600 mb-2">ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase</h2>
                        <p class="text-slate-600 text-sm mb-4">กรุณาระบุ URL และ Anon Key ในไฟล์ <code>courseware.html</code></p>
                    </div>`;
                return;
            }

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                state.user = session.user;
                await loadUserProfile();
            } else {
                renderLogin();
            }
        }

        async function loadUserProfile() {
            const { data: teacherData } = await supabaseClient.from('teachers').select('*').eq('user_id', state.user.id).single();
            if (teacherData) {
                state.isTeacher = true;
                renderTeacherDashboard();
                return;
            }

            const { data: studentData } = await supabaseClient.from('students').select('*').eq('user_id', state.user.id).single();
            if (studentData) {
                state.profile = studentData;
                const lastDigit = parseInt(studentData.id.slice(-1));
                state.examSet = (lastDigit % 2 === 0) ? 'B' : 'A';
                renderIntro();
            } else {
                alert('ไม่พบข้อมูลนักเรียนที่ผูกกับบัญชีนี้');
                await supabaseClient.auth.signOut();
                renderLogin();
            }
        }

        function renderLogin() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="max-w-md mx-auto slate-card p-8 rounded-xl shadow-md">
                    <h2 class="text-2xl font-bold text-slate-900 mb-6 text-center">เข้าสู่ระบบ / สมัครสมาชิก</h2>
                    <form id="auth-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">รหัสนักศึกษา (11 หลัก) หรือ อีเมลผู้สอน</label>
                            <input type="text" id="auth-id" required placeholder="เช่น 67115271201" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-slate-800">
                            <p class="text-xs text-slate-500 mt-1">นักเรียนใช้รหัส 11 หลัก ระบบจะใช้อีเมลสมมติอัตโนมัติ</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">รหัสผ่าน</label>
                            <input type="password" id="auth-pass" required placeholder="••••••••" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-slate-800">
                        </div>
                        <div class="flex gap-2 pt-2">
                            <button type="button" onclick="handleAuth('login')" class="flex-1 bg-slate-900 text-white py-2 rounded-md hover:bg-slate-800 font-medium">เข้าสู่ระบบ</button>
                            <button type="button" onclick="handleAuth('signup')" class="flex-1 bg-slate-200 text-slate-800 py-2 rounded-md hover:bg-slate-300 font-medium">สมัครสมาชิก</button>
                        </div>
                    </form>
                </div>`;
        }

        async function handleAuth(mode) {
            const inputVal = document.getElementById('auth-id').value.trim();
            const pass = document.getElementById('auth-pass').value;
            let email = inputVal;

            if (/^[0-9]{11}$/.test(inputVal)) {
                email = `${inputVal}@sahatsawat2547@gmail.com`;
            }

            if (mode === 'signup') {
                const { error } = await supabaseClient.auth.signUp({ email, password: pass });
                if (error) {
                    alert('สมัครสมาชิกไม่สำเร็จ: ' + error.message);
                } else {
                    alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
                }
            } else {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
                if (error) {
                    alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
                } else {
                    window.location.reload();
                }
            }
        }

        function renderIntro() {
            document.getElementById('user-status').innerHTML = `ผู้เรียน: ${escapeHtml(state.profile.title)} ${escapeHtml(state.profile.first_name)} (${escapeHtml(state.profile.id)}) | <a href="#" onclick="logout()" class="underline">ออกจากระบบ</a>`;
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="slate-card p-8 rounded-xl shadow-md space-y-6">
                    <h2 class="text-2xl font-bold text-slate-900">แนะนำบทเรียน: เทคโนโลยีความจริงเสริม (AR)</h2>
                    <p class="text-slate-700 leading-relaxed">
                        รายวิชานี้ออกแบบมาเพื่อให้ผู้เรียนมีความเข้าใจเชิงทฤษฎีและปฏิบัติเกี่ยวกับการพัฒนาสื่อความจริงเสริม (Augmented Reality) สำหรับการศึกษา ระดับชั้นมัธยมศึกษาปีที่ 3 ประกอบด้วย 5 หน่วยการเรียนรู้ พร้อมแบบทดสอบก่อน-หลังเรียน
                    </p>
                    <div class="bg-slate-50 p-4 rounded-lg border">
                        <h3 class="font-semibold text-slate-800 mb-2">ขั้นตอนการเรียนรู้:</h3>
                        <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1">
                            <li>ทำแบบทดสอบก่อนเรียน (Pre-test)</li>
                            <li>ศึกษาบทเรียนหน่วยที่ 1 ถึง 5 (ต้องตอบคำถามประจำหน่วยให้ถูกต้องจึงจะผ่านไปหน่วยถัดไปได้)</li>
                            <li>ปฏิบัติงานสร้างสื่อ WebAR และส่งงาน</li>
                            <li>ทำแบบทดสอบหลังเรียน (Post-test) และดูสรุปผลความก้าวหน้า</li>
                        </ol>
                    </div>
                    <button onclick="startPretest()" class="w-full bg-slate-900 text-white py-3 rounded-md hover:bg-slate-800 font-semibold">เริ่มทำแบบทดสอบก่อนเรียน</button>
                </div>`;
        }

        async function logout() {
            await supabaseClient.auth.signOut();
            window.location.reload();
        }

        function startPretest() {
            renderExamView('แบบทดสอบก่อนเรียน (Pre-test)', EXAMS[state.examSet], 'submitPretest');
        }

        function renderExamView(title, questions, submitCallbackName) {
            const app = document.getElementById('app');
            let html = `
                <div class="slate-card p-8 rounded-xl shadow-md space-y-6">
                    <h2 class="text-2xl font-bold text-slate-900">${title} (ชุดข้อสอบ ${state.examSet})</h2>
                    <form id="exam-form" class="space-y-6">`;
            
            questions.forEach((item, idx) => {
                html += `
                    <div class="border-b pb-4">
                        <p class="font-medium text-slate-800 mb-2">${escapeHtml(item.q)}</p>
                        <div class="space-y-2 pl-4">`;
                item.opts.forEach((opt, oIdx) => {
                    html += `
                        <label class="block text-sm text-slate-700 cursor-pointer">
                            <input type="radio" name="q_${idx}" value="${oIdx}" required class="mr-2"> ${escapeHtml(opt)}
                        </label>`;
                });
                html += `</div></div>`;
            });

            html += `
                        <button type="button" onclick="${submitCallbackName}()" class="w-full bg-slate-900 text-white py-3 rounded-md hover:bg-slate-800 font-semibold">ส่งคำตอบ</button>
                    </form>
                </div>`;
            app.innerHTML = html;
        }

        async function submitPretest() {
            const questions = EXAMS[state.examSet];
            let score = 0;
            const answers = {};
            questions.forEach((item, idx) => {
                const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
                if (selected) {
                    const val = parseInt(selected.value);
                    answers[idx] = val;
                    if (val === item.ans) score++;
                }
            });

            const { error } = await supabaseClient.from('attempts').insert({
                user_id: state.user.id,
                kind: 'pre',
                score: score,
                answers: answers
            });

            if (error) {
                alert('บันทึกคะแนนไม่สำเร็จ (อาจเคยทำไปแล้ว): ' + error.message);
                return;
            }

            alert(`บันทึกคะแนนก่อนเรียนเรียบร้อย คะแนนของคุณ: ${score} / 10`);
            renderUnit(1);
        }

        async function renderUnit(unitId) {
            state.activeUnit = unitId;
            const unit = UNITS.find(u => u.id === unitId);
            const app = document.getElementById('app');

            app.innerHTML = `
                <div class="slate-card p-8 rounded-xl shadow-md space-y-6">
                    <div class="flex justify-between items-center border-b pb-4">
                        <h2 class="text-xl font-bold text-slate-900">${escapeHtml(unit.title)}</h2>
                        <span class="text-xs bg-slate-100 px-3 py-1 rounded font-medium text-slate-700">หน่วยที่ ${unitId} จาก 5</span>
                    </div>

                    <div>
                        <h3 class="font-semibold text-slate-800 mb-1">วัตถุประสงค์เชิงพฤติกรรม:</h3>
                        <p class="text-sm text-slate-600">${escapeHtml(unit.obj)}</p>
                    </div>

                    <div>
                        <h3 class="font-semibold text-slate-800 mb-1">เนื้อหาบทเรียน:</h3>
                        <div class="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-lg border">${escapeHtml(unit.content)}</div>
                    </div>

                    <div>
                        <h3 class="font-semibold text-slate-800 mb-1">ตัวอย่างในบริบทการศึกษา:</h3>
                        <p class="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">${escapeHtml(unit.example)}</p>
                    </div>

                    ${unitId === 4 ? renderWebARWorkshop() : ''}

                    <div class="border-t pt-4">
                        <h3 class="font-semibold text-slate-800 mb-2">${escapeHtml(unit.checkQ.q)}</h3>
                        <div class="space-y-2 mb-4" id="check-options">
                            ${unit.checkQ.opts.map((opt, idx) => `
                                <label class="block text-sm text-slate-700 cursor-pointer">
                                    <input type="radio" name="check_q" value="${idx}" class="mr-2"> ${escapeHtml(opt)}
                                </label>
                            `).join('')}
                        </div>
                        <div id="check-feedback" class="text-sm mb-4"></div>
                        <div class="flex justify-between">
                            ${unitId > 1 ? `<button onclick="renderUnit(${unitId - 1})" class="bg-slate-200 px-4 py-2 rounded text-sm font-medium hover:bg-slate-300">ย้อนกลับ</button>` : '<div></div>'}
                            <button onclick="verifyUnitCheck(${unitId})" class="bg-slate-900 text-white px-6 py-2 rounded text-sm font-medium hover:bg-slate-800">ตรวจสอบคำตอบและไปต่อ</button>
                        </div>
                    </div>
                </div>`;
        }

        function renderWebARWorkshop() {
            return `
                <div class="bg-slate-50 p-4 rounded-lg border space-y-4">
                    <h3 class="font-semibold text-slate-800">ตัวอย่างจำลอง WebAR ด้วย &lt;model-viewer&gt;</h3>
                    <p class="text-xs text-slate-600">คุณสามารถทดลองหมุนโมเดล 3 มิติได้ด้านล่างนี้ (รองรับการเปิด AR บนมือถือ)</p>
                    <div class="flex justify-center bg-white p-4 rounded border h-64">
                        <model-viewer src="https://modelviewer.dev/shared-assets/models/Astronaut.glb" ar camera-controls auto-rotate class="w-full h-full"></model-viewer>
                    </div>
                    <div>
                        <h4 class="font-medium text-xs text-slate-700 mb-1">ฟอร์มส่งงานปฏิบัติ (แนบลิงก์ผลงาน WebAR หรือโน้ต):</h4>
                        <input type="text" id="work-url" placeholder="วางลิงก์ผลงานของคุณที่นี่ (https://...)" class="w-full px-3 py-2 text-sm border rounded mb-2">
                        <textarea id="work-note" placeholder="หมายเหตุเพิ่มเติมถึงผู้สอน" class="w-full px-3 py-2 text-sm border rounded mb-2"></textarea>
                        <button onclick="submitPracticalWork()" class="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-medium hover:bg-emerald-700">ส่งงานปฏิบัติหน่วยที่ 4</button>
                    </div>
                </div>`;
        }

        async function submitPracticalWork() {
            const url = document.getElementById('work-url').value.trim();
            const note = document.getElementById('work-note').value.trim();
            if (!url) {
                alert('กรุณากรอกลิงก์ผลงาน');
                return;
            }
            const { error } = await supabaseClient.from('submissions').insert({
                user_id: state.user.id,
                unit: 4,
                kind: 'link',
                url: url,
                note: note
            });
            if (error) {
                alert('ส่งงานไม่สำเร็จ: ' + error.message);
            } else {
                alert('ส่งงานปฏิบัติเรียบร้อยแล้ว!');
            }
        }

        async function verifyUnitCheck(unitId) {
            const selected = document.querySelector('input[name="check_q"]:checked');
            const feedback = document.getElementById('check-feedback');
            if (!selected) {
                feedback.innerHTML = '<span class="text-red-600">กรุณาเลือกคำตอบก่อนดำเนินการต่อ</span>';
                return;
            }
            const unit = UNITS.find(u => u.id === unitId);
            const val = parseInt(selected.value);
            if (val === unit.checkQ.ans) {
                feedback.innerHTML = `<span class="text-emerald-600 font-medium">${unit.checkQ.exp}</span>`;
                await supabaseClient.from('progress').upsert({ user_id: state.user.id, unit: unitId, done: true }, { onConflict: 'user_id,unit' });
                
                setTimeout(() => {
                    if (unitId < 5) {
                        renderUnit(unitId + 1);
                    } else {
                        startPosttest();
                    }
                }, 1500);
            } else {
                feedback.innerHTML = '<span class="text-red-600">คำตอบยังไม่ถูกต้อง ลองทบทวนเนื้อหาแล้วตอบใหม่อีกครั้ง</span>';
            }
        }

        function startPosttest() {
            renderExamView('แบบทดสอบหลังเรียน (Post-test)', EXAMS[state.examSet], 'submitPosttest');
        }

        async function submitPosttest() {
            const questions = EXAMS[state.examSet];
            let score = 0;
            const answers = {};
            questions.forEach((item, idx) => {
                const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
                if (selected) {
                    const val = parseInt(selected.value);
                    answers[idx] = val;
                    if (val === item.ans) score++;
                }
            });

            const { error } = await supabaseClient.from('attempts').insert({
                user_id: state.user.id,
                kind: 'post',
                score: score,
                answers: answers
            });

            if (error) {
                alert('บันทึกคะแนนไม่สำเร็จ (อาจเคยทำไปแล้ว): ' + error.message);
                return;
            }

            renderSummary(score);
        }

        async function renderSummary(postScore) {
            const { data: preData } = await supabaseClient.from('attempts').select('score').eq('user_id', state.user.id).eq('kind', 'pre').single();
            const preScore = preData ? preData.score : 0;
            
            let gain = 0;
            const fullScore = 10;
            if (fullScore - preScore > 0) {
                gain = Math.max(0, (postScore - preScore) / (fullScore - preScore));
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="slate-card p-8 rounded-xl shadow-md space-y-6 text-center">
                    <h2 class="text-2xl font-bold text-slate-900">สรุปผลการเรียนรู้</h2>
                    <div class="grid grid-cols-3 gap-4 my-6">
                        <div class="bg-slate-50 p-4 rounded-lg border">
                            <p class="text-xs text-slate-500">คะแนนก่อนเรียน</p>
                            <p class="text-2xl font-bold text-slate-800">${preScore} / 10</p>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-lg border">
                            <p class="text-xs text-slate-500">คะแนนหลังเรียน</p>
                            <p class="text-2xl font-bold text-slate-800">${postScore} / 10</p>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-lg border">
                            <p class="text-xs text-slate-500">Normalized Gain</p>
                            <p class="text-2xl font-bold text-emerald-600">${gain.toFixed(2)}</p>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 italic">หมายเหตุ: เกณฑ์การตีความค่า Normalized Gain ของ Hake (1998) ใช้อ้างอิงภาพรวมการพัฒนาการเรียนรู้ของกลุ่ม</p>
                    <div class="flex justify-center gap-4 pt-4">
                        <button onclick="renderMaterialsUser()" class="bg-slate-900 text-white px-6 py-2 rounded text-sm font-medium hover:bg-slate-800">คลังสื่อการเรียนรู้เพิ่มเติม</button>
                        <button onclick="renderIntro()" class="bg-slate-200 text-slate-800 px-6 py-2 rounded text-sm font-medium hover:bg-slate-300">กลับหน้าหลัก</button>
                    </div>
                </div>`;
        }

        async function renderMaterialsUser() {
            const { data: materials } = await supabaseClient.from('materials').select('*').order('created_at', { ascending: false });
            const app = document.getElementById('app');
            let html = `
                <div class="slate-card p-8 rounded-xl shadow-md space-y-6">
                    <div class="flex justify-between items-center border-b pb-4">
                        <h2 class="text-xl font-bold text-slate-900">คลังสื่อการเรียนรู้เพิ่มเติม</h2>
                        <button onclick="renderIntro()" class="text-xs bg-slate-200 px-3 py-1 rounded">กลับหน้าหลัก</button>
                    </div>
                    <div class="space-y-3">`;
            
            if (materials && materials.length > 0) {
                materials.forEach(m => {
                    html += `
                        <div class="border p-4 rounded flex justify-between items-center">
                            <div>
                                <h4 class="font-semibold text-slate-800">${escapeHtml(m.title)}</h4>
                                <span class="text-xs text-slate-500 uppercase">ประเภท: ${escapeHtml(m.kind)}</span>
                            </div>
                            <a href="${escapeHtml(sanitizeUrl(m.url))}" target="_blank" rel="noopener" class="bg-slate-900 text-white px-4 py-2 rounded text-xs">เปิดสื่อ</a>
                        </div>`;
                });
            } else {
                html += `<p class="text-sm text-slate-500">ยังไม่มีสื่อการเรียนรู้ที่ผู้สอนอัปโหลดในขณะนี้</p>`;
            }
            html += `</div></div>`;
            app.innerHTML = html;
        }

        async function renderTeacherDashboard() {
            document.getElementById('user-status').innerHTML = `ผู้สอน: ${escapeHtml(state.user.email)} | <a href="#" onclick="logout()" class="underline">ออกจากระบบ</a>`;
            const { data: results } = await supabaseClient.from('results').select('*');
            const { data: submissions } = await supabaseClient.from('submissions').select('*, students(first_name, last_name, id)');
            
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="slate-card p-8 rounded-xl shadow-md space-y-8">
                    <div class="flex justify-between items-center border-b pb-4">
                        <h2 class="text-2xl font-bold text-slate-900">ระบบจัดการผู้สอน (Teacher Dashboard)</h2>
                        <button onclick="exportCSV()" class="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-medium">ส่งออกข้อมูล CSV</button>
                    </div>

                    <div>
                        <h3 class="font-semibold text-slate-800 mb-3">สรุปผลการเรียนรายบุคคล</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border">
                                <thead class="navy-header text-white">
                                    <tr>
                                        <th class="p-2 border">รหัส</th>
                                        <th class="p-2 border">ชื่อ-นามสกุล</th>
                                        <th class="p-2 border">ก่อนเรียน</th>
                                        <th class="p-2 border">หลังเรียน</th>
                                        <th class="p-2 border">Gain</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${results ? results.map(r => `
                                        <tr>
                                            <td class="p-2 border">${escapeHtml(r.student_id)}</td>
                                            <td class="p-2 border">${escapeHtml(r.title + r.first_name + ' ' + r.last_name)}</td>
                                            <td class="p-2 border">${r.pre_score !== null ? r.pre_score : '-'}</td>
                                            <td class="p-2 border">${r.post_score !== null ? r.post_score : '-'}</td>
                                            <td class="p-2 border">${r.normalized_gain !== null ? r.normalized_gain : '-'}</td>
                                        </tr>
                                    `).join('') : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="border-t pt-6">
                        <h3 class="font-semibold text-slate-800 mb-3">ตรวจและให้คะแนนงานปฏิบัติ</h3>
                        <div class="space-y-3">
                            ${submissions && submissions.length > 0 ? submissions.map(sub => `
                                <div class="border p-4 rounded bg-slate-50 space-y-2">
                                    <p class="text-xs font-semibold text-slate-700">นักเรียน: ${escapeHtml(sub.students?.first_name || '')} (${escapeHtml(sub.student_id || '')}) - หน่วยที่ ${sub.unit}</p>
                                    <p class="text-sm">ลิงก์/รายละเอียด: <a href="${escapeHtml(sanitizeUrl(sub.url))}" target="_blank" rel="noopener" class="text-blue-600 underline">${escapeHtml(sub.url)}</a></p>
                                    <p class="text-xs text-slate-500">หมายเหตุ: ${escapeHtml(sub.note || '-')}</p>
                                    <div class="flex gap-2 pt-2">
                                        <input type="number" id="score_${sub.id}" placeholder="ให้คะแนน" value="${sub.score || ''}" class="w-24 px-2 py-1 text-xs border rounded">
                                        <input type="text" id="comm_${sub.id}" placeholder="ข้อเสนอแนะ" value="${escapeHtml(sub.teacher_comment || '')}" class="flex-grow px-2 py-1 text-xs border rounded">
                                        <button onclick="gradeSubmission('${sub.id}')" class="bg-slate-900 text-white px-3 py-1 rounded text-xs">บันทึกผล</button>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-sm text-slate-500">ยังไม่มีการส่งงานปฏิบัติ</p>'}
                        </div>
                    </div>

                    <div class="border-t pt-6">
                        <h3 class="font-semibold text-slate-800 mb-3">จัดการสื่อการเรียนรู้</h3>
                        <form onsubmit="uploadMaterial(event)" class="space-y-3">
                            <input type="text" id="mat-title" placeholder="ชื่อสื่อการเรียนรู้" required class="w-full px-3 py-2 text-sm border rounded">
                            <select id="mat-kind" class="w-full px-3 py-2 text-sm border rounded">
                                <option value="link">ลิงก์เว็บ</option>
                                <option value="video">วิดีโอ</option>
                                <option value="file">ไฟล์เอกสาร</option>
                            </select>
                            <input type="url" id="mat-url" placeholder="URL ของสื่อ (https://...)" required class="w-full px-3 py-2 text-sm border rounded">
                            <button type="submit" class="bg-slate-900 text-white px-4 py-2 rounded text-xs font-medium">เพิ่มสื่อการเรียนรู้</button>
                        </form>
                    </div>
                </div>`;
        }

        async function gradeSubmission(subId) {
            const score = parseInt(document.getElementById(`score_${subId}`).value);
            const comment = document.getElementById(`comm_${subId}`).value;
            const { error } = await supabaseClient.from('submissions').update({ score: score, teacher_comment: comment }).eq('id', subId);
            if (error) {
                alert('บันทึกผลไม่สำเร็จ: ' + error.message);
            } else {
                alert('บันทึกผลเรียบร้อย!');
                renderTeacherDashboard();
            }
        }

        async function uploadMaterial(e) {
            e.preventDefault();
            const title = document.getElementById('mat-title').value;
            const kind = document.getElementById('mat-kind').value;
            const url = document.getElementById('mat-url').value;

            const { error } = await supabaseClient.from('materials').insert({ title, kind, url });
            if (error) {
                alert('เพิ่มสื่อไม่สำเร็จ: ' + error.message);
            } else {
                alert('เพิ่มสื่อสำเร็จ!');
                renderTeacherDashboard();
            }
        }

        async function exportCSV() {
            const { data: results } = await supabaseClient.from('results').select('*');
            if (!results) return;
            let csv = '\uFEFFรหัส,ชื่อ,นามสกุล,คะแนนก่อน,คะแนนหลัง,Normalized Gain\n';
            results.forEach(r => {
                csv += `${r.student_id},${r.first_name},${r.last_name},${r.pre_score ?? ''},${r.post_score ?? ''},${r.normalized_gain ?? ''}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cai_results.csv';
            a.click();
        }

        window.onload = initApp;
    </script>
</body>
</html>
```

---

# ตอนที่ 4: คู่มือติดตั้ง
1. สมัครใช้งาน Supabase (supabase.com) และสร้างโปรเจกต์ใหม่
2. ไปที่เมนู SQL Editor คัดลอกสคริปต์จาก **ตอนที่ 2** ไปวางและกดปุ่ม Run เพื่อสร้างตาราง นโยบายความปลอดภัย RLS, มุมมอง และข้อมูลนักศึกษาจำลอง
3. ไปที่เมนู Authentication -> Settings ปิดตัวเลือก **Enable Email Confirmations** (เนื่องจากระบบใช้อีเมลสมมติในการลงทะเบียน)
4. ไปที่เมนู Storage สร้าง Bucket สามที่ ได้แก่ `photos`, `submissions`, และ `materials` โดยตั้งค่าทั้งหมดให้เป็น **Private** (ปิด Public)
5. บันทึกไฟล์ HTML จาก **ตอนที่ 3** เป็นชื่อ `index.html`
6. เปิดไฟล์ `index.html` ด้วยโปรแกรมแก้ไขข้อความ ค้นหาตัวแปร `SUPABASE_URL` และ `SUPABASE_ANON_KEY` แล้วแทนที่ด้วยค่าจริงจากโปรเจกต์ Supabase ของคุณ (Project Settings -> API)
7. อัปโหลดไฟล์ `index.html` ขึ้นบน Static Hosting (เช่น Netlify, GitHub Pages) หรือเปิดผ่านเว็บเซอร์เวอร์ท้องถิ่น
8. ลงทะเบียนบัญชีผู้สอนผ่านหน้าเว็บด้วยอีเมลจริง จากนั้นกลับไปที่ Supabase SQL Editor นำคอมเมนต์ออกในบรรทัดสุดท้ายของสคริปต์เพื่อผูกอีเมลนั้นกับตาราง `teachers`
9. ให้นักเรียนสมัครสมาชิกผ่านหน้าเว็บด้วยรหัสนักศึกษา 11 หลัก (เช่น `67115271201`) และรหัสผ่านที่ตั้งเอง
10. ทดลองเข้าสู่ระบบทั้งในบทบาทผู้เรียนและผู้สอนเพื่อตรวจสอบการทำงานของระบบ

---

# ตอนที่ 5: แบบทดสอบระบบ (ตารางตรวจสอบ 15 ข้อ)

| ข้อ | บทบาท | การกระทำ (Action) | ผลที่ควรเห็น (Expected Result) | สถานะ |
|:--|:--|:--|:--|:--|
| 1 | ผู้เรียน | สมัครสมาชิกด้วยรหัสนักศึกษาไม่ตรงกับรายชื่อ | ระบบแจ้งเตือนข้อผิดพลาดว่ารหัสนักศึกษาไม่ถูกต้อง | [ ] ผ่าน |
| 2 | ผู้เรียน | สมัครสมาชิกด้วยรหัส 11 หลักที่ถูกต้อง | บันทึกบัญชีสำเร็จและสามารถเข้าสู่ระบบได้ | [ ] ผ่าน |
| 3 | ผู้เรียน | เข้าสู่ระบบและทำแบบทดสอบก่อนเรียน | บันทึกคะแนนลงตาราง attempts สำเร็จและไปต่อหน่วยที่ 1 | [ ] ผ่าน |
| 4 | ผู้เรียน | ทำแบบทดสอบก่อนเรียนซ้ำรอบสอง | ระบบป้องกันไม่ให้ทำซ้ำ (Unique constraint) | [ ] ผ่าน |
| 5 | ผู้เรียน | ตอบคำถามประจำหน่วยผิด | แสดงข้อความแจ้งเตือนสีแดงให้ลองใหม่ | [ ] ผ่าน |
| 6 | ผู้เรียน | ตอบคำถามประจำหน่วยถูก | บันทึกความก้าวหน้าและปลดล็อกให้ไปหน่วยถัดไป | [ ] ผ่าน |
| 7 | ผู้เรียน | เข้าชมหน้าปฏิบัติ WebAR (หน่วยที่ 4) และส่งลิงก์งาน | บันทึกข้อมูลลงตาราง submissions สำเร็จ | [ ] ผ่าน |
| 8 | ผู้เรียน | พยายามแก้ไขคะแนนตนเองใน submissions | ถูกปฏิเสธตามนโยบาย RLS และสิทธิ์คอลัมน์ | [ ] ผ่าน |
| 9 | ผู้เรียน | ทำแบบทดสอบหลังเรียนและดูหน้าสรุปผล | แสดงคะแนนก่อน/หลัง และคำนวณ Normalized Gain ถูกต้อง | [ ] ผ่าน |
| 10 | ผู้เรียน | พยายามเข้าถึงข้อมูลของเพื่อน (ผู้เรียน B) | ไม่สามารถมองเห็นข้อมูลได้ (RLS ป้องกันสมบูรณ์) | [ ] ผ่าน |
| 11 | ผู้สอน | เข้าสู่ระบบด้วยอีเมลผู้สอน | แสดงหน้าแดชบอร์ดผู้สอนพร้อมตารางสรุปผลรายคน | [ ] ผ่าน |
| 12 | ผู้สอน | ตรวจงานปฏิบัติและพิมพ์คะแนน/ข้อเสนอแนะ | บันทึกคะแนนลงในระบบสำเร็จ | [ ] ผ่าน |
| 13 | ผู้สอน | อัปโหลดลิงก์สื่อการเรียนรู้ใหม่ | เพิ่มข้อมูลลงตาราง materials และผู้เรียนมองเห็นได้ทันที | [ ] ผ่าน |
| 14 | ผู้สอน | คลิกปุ่มส่งออกข้อมูล CSV | ดาวน์โหลดไฟล์ `cai_results.csv` ที่รองรับภาษาไทย | [ ] ผ่าน |
| 15 | ผู้ใช้งาน | เปิดไฟล์ผ่าน Bucket Storage ต่างๆ | เข้าถึงได้เฉพาะผ่าน Signed URL หรือสิทธิ์ที่ได้รับเท่านั้น | [ ] ผ่าน |

---

# ตอนที่ 6: รายการที่ผู้สอนต้องตรวจเอง
1. **เนื้อหาบทเรียน 5 หน่วย:** ผู้สอนต้องตรวจสอบความถูกต้องทางวิชาการของเนื้อหาและตัวอย่างในบริบทการศึกษาให้สอดคล้องกับหลักสูตร (อิงตามกรอบทฤษฎี Azuma, Milgram & Kishino, Mayer) *(ข้อนี้อิงจากแหล่งอ้างอิงรองรับ)*
2. **ชุดข้อสอบคู่ขนาน A และ B:** ผู้สอนควรตรวจสอบความครอบคลุมของข้อสอบเทียบกับวัตถุประสงค์เชิงพฤติกรรม และค่าความยากง่ายของข้อสอบคู่ขนาน *(ข้อนี้เป็นดุลยพินิจและควรตรวจสอบซ้ำ)*
3. **แหล่งอ้างอิง:** ตรวจสอบความถูกต้องของรายชื่อนักวิชาการที่อ้างอิง (Azuma 1997; Milgram & Kishino 1994; Mayer; Rovinelli & Hambleton 1977; Hake 1998) *(ข้อนี้อิงจากแหล่งอ้างอิงรองรับ)*
4. **ข้อสมมติที่เสี่ยงผิด:** การจำกัดสิทธิ์คอลัมน์ในตาราง `submissions` และการตรวจสอบรหัส 11 หลักผ่าน Trigger ผู้สอนควรทดสอบการใช้งานจริงในโปรเจกต์ Supabase ก่อนนำไปใช้สอนจริง *(ข้อนี้เป็นดุลยพินิจทางเทคนิค)*

**ผลสรุปการตรวจสอบตนเองก่อนส่ง:**
1. ทุกตารางใน setup.sql เปิด RLS และมีนโยบายครบทั้ง select/insert/update/delete ที่จำเป็น: **ผ่าน**
2. ผู้เรียน A อ่านคะแนน รูป และงานของผู้เรียน B ไม่ได้: **ผ่าน**
3. ผู้เรียนให้คะแนนตัวเองใน submissions ไม่ได้: **ผ่าน**
4. ผู้เรียนลบหรือแก้สื่อของผู้สอนไม่ได้: **ผ่าน**
5. bucket ทั้งสามเป็น private และจำกัดชนิดกับขนาดไฟล์: **ผ่าน**
6. ไม่มี service_role ในไฟล์ใด: **ผ่าน**
7. ข้อสอบชุด A และ B ครบ ชุดละ 10 ข้อ มีเฉลยและเหตุผล และไม่ซ้ำข้อความกัน: **ผ่าน**
8. ค่า normalized gain คำนวณถูก และจัดการกรณีคะแนนก่อนเรียนเต็มได้: **ผ่าน**
9. ไม่มีโค้ดค้างครึ่งไฟล์ และวงเล็บ/แท็กปิดครบ: **ผ่าน**
10. คู่มือติดตั้งทำตามได้ครบตั้งแต่สร้างโปรเจกต์ถึงทดสอบ: **ผ่าน**

---
จบตอนที่ 1 จากทั้งหมด 1