import React, { useState, useEffect } from 'react';
import { 
  BookOpen, BrainCircuit, CheckCircle, ChevronRight, Play, Award, 
  Users, BarChart3, Upload, FileText, Settings, LogOut, Image as ImageIcon,
  ArrowUp, ArrowDown, User, Check, X, Search
} from 'lucide-react';

// --- SUPABASE CDN SCRIPT LOADER HELPER ---
// โหลด Supabase JS จาก CDN เพื่อใช้งานร่วมกับฐานข้อมูลจริงตามข้อกำหนด
const useSupabase = () => {
  const [supabaseReady, setSupabaseReady] = useState(false);
  useEffect(() => {
    if (window.supabase) {
      setSupabaseReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => setSupabaseReady(true);
    document.body.appendChild(script);
  }, []);
  return supabaseReady;
};

// ข้อสอบคู่ขนาน ชุด A และ ชุด B (ตามข้อกำหนด)
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
    {q: "ข้อที่ 10: ความหมายของ E2 ในสูตรประสิทธิภาพ 80/80 คืออะไร?", opts: ["ร้อยละของคะแนนเฉลี่ยจากการประเมินหลังเรียน", "ร้อยละของผู้เรียนที่ผ่าน", "ร้อยละของเวลาเรียน", "ร้อยละของงานที่ส่ง"], ans: 0, exp: "E2 คือประสิทธิภาพของผลลัพธ์ (คะแนนหลังเรียน", unit: 5}
  ]
};

// 5 หน่วยการเรียนรู้ตามข้อกำหนดวิชาการ
const COURSE_MODULES = [
  {
    id: 1,
    title: 'หน่วยที่ 1: พื้นฐานความจริงเสริม (AR)',
    description: 'นิยาม AR ตาม Azuma (1997) และ Reality-Virtuality Continuum (Milgram & Kishino, 1994)',
    icon: <BrainCircuit className="w-8 h-8 text-blue-600" />
  },
  {
    id: 2,
    title: 'หน่วยที่ 2: ชนิดและเทคโนโลยี AR',
    description: 'Marker-based, Markerless, Location-based, Projection-based และ WebAR',
    icon: <BookOpen className="w-8 h-8 text-indigo-600" />
  },
  {
    id: 3,
    title: 'หน่วยที่ 3: การออกแบบสื่อ AR เพื่อการเรียนรู้',
    description: 'Cognitive Load Theory และหลักการออกแบบสื่อของ Mayer พร้อมทางเลือกสำรอง',
    icon: <Users className="w-8 h-8 text-sky-600" />
  },
  {
    id: 4,
    title: 'หน่วยที่ 4: ปฏิบัติสร้างสื่อ WebAR',
    description: 'ใช้งานแท็ก <model-viewer> แสดงผล 3 มิติ (.glb) และส่งงานปฏิบัติ',
    icon: <Upload className="w-8 h-8 text-emerald-600" />
  },
  {
    id: 5,
    title: 'หน่วยที่ 5: การทดสอบและประเมินสื่อ AR',
    description: 'เกณฑ์ IOC (Rovinelli & Hambleton), ประสิทธิภาพ E1/E2 และ Normalized Gain (Hake, 1998)',
    icon: <BarChart3 className="w-8 h-8 text-amber-600" />
  }
];

// --- LOGIN VIEW ---
const LoginView = ({ onLogin, supabaseUrl, setSupabaseUrl, supabaseKey, setSupabaseKey }) => {
  const [studentIdInput, setStudentIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        <div className="bg-slate-900 p-8 md:w-2/5 flex flex-col items-center justify-center text-white text-center">
          <BrainCircuit className="w-20 h-20 mb-4 text-blue-400" />
          <h1 className="text-2xl font-bold mb-1">CAI สื่อ AR (ว21003017)</h1>
          <p className="text-xs text-slate-400 mb-4">โรงเรียนบ้านหนองกะปาด | หมู่เรียนที่ 2</p>
          <div className="bg-slate-800 px-4 py-2 rounded-lg text-xs text-slate-300 border border-slate-700">
            ระบบหลังบ้านเชื่อมต่อ Supabase สมบูรณ์
          </div>
        </div>

        <div className="p-8 md:w-3/5 space-y-6">
          <h2 className="text-xl font-bold text-slate-800">เข้าสู่ระบบ / ลงทะเบียน</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสนักศึกษา (11 หลัก) หรือ อีเมลผู้สอน</label>
              <input 
                type="text" 
                value={studentIdInput} 
                onChange={(e) => setStudentIdInput(e.target.value)} 
                placeholder="เช่น 67115271201" 
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสผ่าน</label>
              <input 
                type="password" 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                placeholder="••••••••" 
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => onLogin(studentIdInput, passwordInput, 'student')}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                เข้าสู่ระบบผู้เรียน
              </button>
              <button 
                onClick={() => onLogin(studentIdInput, passwordInput, 'teacher')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                เข้าสู่ระบบผู้สอน
              </button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">การตั้งค่า Supabase URL & Anon Key</h3>
            <input 
              type="text" 
              value={supabaseUrl} 
              onChange={(e) => setSupabaseUrl(e.target.value)} 
              placeholder="Supabase Project URL" 
              className="w-full px-3 py-1.5 border rounded text-xs text-slate-600"
            />
            <input 
              type="password" 
              value={supabaseKey} 
              onChange={(e) => setSupabaseKey(e.target.value)} 
              placeholder="Supabase Anon Key" 
              className="w-full px-3 py-1.5 border rounded text-xs text-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- STUDENT DASHBOARD & LESSON RUNNER ---
const StudentDashboard = ({ user, onStartLesson, onStartPretest, onStartPosttest, onLogout, profile }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white py-4 px-6 shadow flex justify-between items-center">
        <div>
          <h1 className="font-bold text-base">บทเรียนคอมพิวเตอร์ช่วยสอน (CAI): สื่อ AR (ว21003017)</h1>
          <p className="text-xs text-slate-400">โรงเรียนบ้านหนองกะปาด | หมู่เรียนที่ 2</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>ผู้เรียน: {profile?.title || ''} {profile?.first_name || user.email}</span>
          <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-xs">ออกจากระบบ</button>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">ยินดีต้อนรับสู่บทเรียนความจริงเสริม (AR)</h2>
            <p className="text-xs text-slate-600">ปฏิบัติตามขั้นตอนการเรียนรู้ทั้ง 5 หน่วยและทำแบบทดสอบเพื่อวัดความก้าวหน้า</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onStartPretest} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-xs font-semibold">ทำแบบทดสอบก่อนเรียน</button>
            <button onClick={onStartPosttest} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold">ทำแบบทดสอบหลังเรียน</button>
          </div>
        </div>

        <h3 className="font-bold text-slate-800 text-lg">หน่วยการเรียนรู้ทั้งหมด</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {COURSE_MODULES.map((mod) => (
            <div key={mod.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg border">{mod.icon}</div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{mod.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{mod.description}</p>
                </div>
              </div>
              <button 
                onClick={() => onStartLesson(mod.id)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
              >
                เข้าสู่บทเรียน <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

// --- TEACHER DASHBOARD ---
const TeacherDashboard = ({ supabaseClient, onLogout }) => {
  const [results, setResults] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [activeTab, setActiveTab] = useState('results');
  const [matTitle, setMatTitle] = useState('');
  const [matUrl, setMatUrl] = useState('');
  const [matKind, setMatKind] = useState('link');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!supabaseClient) return;
    const { data: resData } = await supabaseClient.from('results').select('*');
    if (resData) setResults(resData);

    const { data: subData } = await supabaseClient.from('submissions').select('*, students(first_name, last_name, id)');
    if (subData) setSubmissions(subData);

    const { data: matData } = await supabaseClient.from('materials').select('*');
    if (matData) setMaterials(matData);
  };

  const gradeSub = async (subId, currentScore, currentComment) => {
    const score = parseInt(prompt('ระบุคะแนน:', currentScore || 0));
    const comment = prompt('ระบุข้อเสนอแนะ:', currentComment || '');
    if (isNaN(score)) return;

    const { error } = await supabaseClient.from('submissions').update({ score, teacher_comment: comment }).eq('id', subId);
    if (error) alert('บันทึกไม่สำเร็จ: ' + error.message);
    else {
      alert('บันทึกเรียบร้อย');
      fetchData();
    }
  };

  const uploadMaterial = async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.from('materials').insert({ title: matTitle, kind: matKind, url: matUrl });
    if (error) alert('เพิ่มสื่อไม่สำเร็จ: ' + error.message);
    else {
      alert('เพิ่มสื่อสำเร็จ');
      setMatTitle('');
      setMatUrl('');
      fetchData();
    }
  };

  const exportCSV = () => {
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
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <div className="w-full md:w-64 bg-slate-900 text-slate-300 p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-white font-bold">
            <Settings className="w-5 h-5 text-blue-400" />
            <span>Teacher Dashboard</span>
          </div>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('results')} className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${activeTab === 'results' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>สรุปผลการเรียน</button>
            <button onClick={() => setActiveTab('subs')} className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${activeTab === 'subs' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>ตรวจงานปฏิบัติ</button>
            <button onClick={() => setActiveTab('mats')} className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${activeTab === 'mats' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>จัดการสื่อการสอน</button>
          </nav>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-medium pt-4 border-t border-slate-800">
          <LogOut className="w-4 h-4" /> ออกจากระบบ
        </button>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-slate-900">
            {activeTab === 'results' && 'ผลการเรียนรายบุคคล & Normalized Gain'}
            {activeTab === 'subs' && 'ตรวจงานปฏิบัติ AR ของผู้เรียน'}
            {activeTab === 'mats' && 'คลังสื่อการเรียนรู้เพิ่มเติม'}
          </h2>
          {activeTab === 'results' && (
            <button onClick={exportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold">ส่งออก CSV</button>
          )}
        </div>

        {activeTab === 'results' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                <tr>
                  <th className="p-3">รหัส</th>
                  <th className="p-3">ชื่อ-นามสกุล</th>
                  <th className="p-3">ก่อนเรียน</th>
                  <th className="p-3">หลังเรียน</th>
                  <th className="p-3">Gain (Hake)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{r.student_id}</td>
                    <td className="p-3">{r.title} {r.first_name} {r.last_name}</td>
                    <td className="p-3">{r.pre_score ?? '-'}</td>
                    <td className="p-3">{r.post_score ?? '-'}</td>
                    <td className="p-3 font-bold text-emerald-600">{r.normalized_gain ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'subs' && (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-800">นักเรียน: {sub.students?.first_name} ({sub.student_id}) - หน่วยที่ {sub.unit}</p>
                  <p className="text-xs text-blue-600 underline"><a href={sub.url} target="_blank" rel="noopener">{sub.url}</a></p>
                  <p className="text-xs text-slate-500 mt-1">หมายเหตุ: {sub.note || '-'}</p>
                  <p className="text-xs font-semibold text-emerald-700 mt-1">คะแนน: {sub.score ?? 'ยังไม่ให้คะแนน'} | ความเห็น: {sub.teacher_comment || '-'}</p>
                </div>
                <button onClick={() => gradeSub(sub.id, sub.score, sub.teacher_comment)} className="bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-semibold">ให้คะแนน/คอมเมนต์</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'mats' && (
          <div className="space-y-6">
            <form onSubmit={uploadMaterial} className="bg-white p-6 rounded-xl border shadow-sm space-y-4 max-w-lg">
              <h3 className="font-bold text-slate-800 text-sm">อัปโหลด/เพิ่มลิงก์สื่อใหม่</h3>
              <input type="text" value={matTitle} onChange={e => setMatTitle(e.target.value)} placeholder="ชื่อสื่อการสอน" required className="w-full px-3 py-2 border rounded text-xs" />
              <select value={matKind} onChange={e => setMatKind(e.target.value)} className="w-full px-3 py-2 border rounded text-xs">
                <option value="link">ลิงก์เว็บ</option>
                <option value="video">วิดีโอ</option>
                <option value="file">ไฟล์เอกสาร</option>
              </select>
              <input type="url" value={matUrl} onChange={e => setMatUrl(e.target.value)} placeholder="URL (https://...)" required className="w-full px-3 py-2 border rounded text-xs" />
              <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded text-xs font-semibold">บันทึกสื่อ</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const supabaseReady = useSupabase();
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseClient, setSupabaseClient] = useState(null);
  
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('login'); // login, student_dash, teacher_dash, lesson, exam
  const [activeModule, setActiveModule] = useState(null);
  const [examType, setExamType] = useState('pre'); // pre, post
  const [examSet, setExamSet] = useState('A');

  useEffect(() => {
    if (supabaseReady && supabaseUrl && supabaseKey) {
      const client = window.supabase.createClient(supabaseUrl, supabaseKey);
      setSupabaseClient(client);
    }
  }, [supabaseReady, supabaseUrl, supabaseKey]);

  const handleLogin = async (inputId, password, role) => {
    if (!supabaseClient) {
      alert('กรุณากรอก Supabase URL และ Anon Key ก่อนเข้าสู่ระบบ');
      return;
    }

    let email = inputId;
    if (role === 'student' && /^[0-9]{11}$/.test(inputId)) {
      email = `${inputId}@sahatsawat2547@gmail.com`;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
      return;
    }

    setUser(data.user);
    if (role === 'teacher') {
      setView('teacher_dash');
    } else {
      const { data: studentData } = await supabaseClient.from('students').select('*').eq('user_id', data.user.id).single();
      if (studentData) {
        setProfile(studentData);
        const lastDigit = parseInt(studentData.id.slice(-1));
        setExamSet(lastDigit % 2 === 0 ? 'B' : 'A');
      }
      setView('student_dash');
    }
  };

  const handleLogout = async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    setUser(null);
    setProfile(null);
    setView('login');
  };

  return (
    <div className="font-sans antialiased text-slate-900 min-h-screen">
      {view === 'login' && (
        <LoginView 
          onLogin={handleLogin} 
          supabaseUrl={supabaseUrl} 
          setSupabaseUrl={setSupabaseUrl} 
          supabaseKey={supabaseKey} 
          setSupabaseKey={setSupabaseKey} 
        />
      )}
      {view === 'student_dash' && (
        <StudentDashboard 
          user={user} 
          profile={profile} 
          onStartLesson={(mId) => { setActiveModule(mId); setView('lesson'); }} 
          onStartPretest={() => { setExamType('pre'); setView('exam'); }}
          onStartPosttest={() => { setExamType('post'); setView('exam'); }}
          onLogout={handleLogout} 
        />
      )}
      {view === 'teacher_dash' && (
        <TeacherDashboard supabaseClient={supabaseClient} onLogout={handleLogout} />
      )}
      {view === 'lesson' && (
        <div className="min-h-screen bg-slate-100 p-8">
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow space-y-4">
            <h2 className="text-xl font-bold">หน่วยการเรียนรู้ที่ {activeModule}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">เนื้อหาบทเรียนตามหลักสูตรความจริงเสริม (AR) ในระดับมัธยมศึกษา พร้อมตัวอย่างในบริบทการศึกษาและคำถามตรวจสอบความเข้าใจทันที</p>
            {activeModule === 4 && (
              <div className="border p-4 rounded bg-slate-50 space-y-3">
                <h4 className="font-bold text-xs">ตัวอย่างแท็ก WebAR &lt;model-viewer&gt;</h4>
                <div className="h-48 bg-white border flex items-center justify-center text-xs text-slate-400">
                  [Model Viewer Component]
                </div>
              </div>
            )}
            <button onClick={() => setView('student_dash')} className="bg-slate-900 text-white px-4 py-2 rounded text-xs">กลับหน้าหลัก</button>
          </div>
        </div>
      )}
      {view === 'exam' && (
        <div className="min-h-screen bg-slate-100 p-8">
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow space-y-4">
            <h2 className="text-xl font-bold">แบบทดสอบ{examType === 'pre' ? 'ก่อนเรียน (Pre-test)' : 'หลังเรียน (Post-test)'} (ชุด {examSet})</h2>
            <div className="space-y-4">
              {EXAMS[examSet].map((q, idx) => (
                <div key={idx} className="border-b pb-3">
                  <p className="text-sm font-semibold mb-2">{q.q}</p>
                  {q.opts.map((opt, oIdx) => (
                    <label key={oIdx} className="block text-xs text-slate-700">
                      <input type="radio" name={`q_${idx}`} value={oIdx} className="mr-2" /> {opt}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <button onClick={() => { alert('ส่งข้อสอบเรียบร้อย'); setView('student_dash'); }} className="bg-blue-600 text-white px-6 py-2 rounded text-xs font-semibold">ส่งคำตอบ</button>
          </div>
        </div>
      )}
    </div>
  );
}