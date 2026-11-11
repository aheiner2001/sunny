import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const args = process.argv.slice(2);
const targetWeek = args.find(arg => !arg.startsWith('--')) || '9';
const shouldOpen = !args.includes('--no-open');

const roadmapPath = path.resolve(process.cwd(), 'courses/cse499/roadmap.json');

if (!fs.existsSync(roadmapPath)) {
  console.error(`Error: Roadmap file not found at ${roadmapPath}`);
  process.exit(1);
}

const roadmap = JSON.parse(fs.readFileSync(roadmapPath, 'utf8'));
const week = roadmap.weeks[targetWeek];

if (!week) {
  console.error(`Error: Week ${targetWeek} is not defined in roadmap.json (available: 9, 10, 11, 12, 13)`);
  process.exit(1);
}

console.log('\n================================================================');
console.log(`🚀 SUNNY FLEET SENIOR PROJECT — WEEK ${targetWeek}: ${week.title}`);
console.log(`⏱️  Planned Hours: ${week.plannedHours} hrs | Logged: ${week.loggedHours} hrs | Status: ${week.status.toUpperCase()}`);
console.log('================================================================\n');

console.log('🧠 CORE ENGINEERING PRINCIPLES:');
week.engineeringPrinciples.forEach((principle, idx) => {
  console.log(`  ${idx + 1}. ${principle}`);
});

console.log('\n📋 WEEKLY TASKS:');
week.tasks.forEach(task => {
  const check = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⬜';
  console.log(`  ${check} [${task.id}] ${task.desc} (${task.status})`);
});

console.log('\n🔗 PRIMARY RESOURCES:');
week.resources.forEach(res => {
  console.log(`  • ${res.name}: ${res.url}`);
});

if (week.lessonFile && fs.existsSync(path.resolve(process.cwd(), week.lessonFile))) {
  console.log(`\n📖 Interactive Lesson: ${week.lessonFile}`);
  if (shouldOpen) {
    const fullPath = path.resolve(process.cwd(), week.lessonFile);
    console.log(`   Opening lesson in browser...`);
    const openCommand = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCommand} "${fullPath}"`);
  }
}
console.log('\n================================================================\n');
