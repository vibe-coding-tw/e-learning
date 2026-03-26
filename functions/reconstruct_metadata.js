const fs = require('fs');
const path = require('path');

const privateCoursesDir = '/Users/roverchen/Documents/web/vibe-coding-tw/functions/private_courses';
const publicCoursesDir = '/Users/roverchen/Documents/web/vibe-coding-tw/public/courses';

const allFiles = [
    ...(fs.existsSync(privateCoursesDir) ? fs.readdirSync(privateCoursesDir).map(f => ({ name: f, dir: privateCoursesDir })) : []),
    ...(fs.existsSync(publicCoursesDir) ? fs.readdirSync(publicCoursesDir).map(f => ({ name: f, dir: publicCoursesDir })) : [])
].filter(f => f.name.endsWith('.html'));

const coursesGrouped = {};

// Group by common prefix: e.g. "00-master", "01-unit", "adv-01-master"
allFiles.forEach(file => {
    // Get numeric parts: e.g. "00", "01", "adv-01", "basic-01"
    const match = file.name.match(/^([a-z0-9-]+)-(master|unit)-/i);
    if (!match) return;
    
    const prefix = match[1];
    const type = match[2]; // "master" or "unit"
    
    if (!coursesGrouped[prefix]) coursesGrouped[prefix] = { masters: [], units: [] };
    
    if (type === 'master') {
        coursesGrouped[prefix].masters.push(file.name);
    } else {
        coursesGrouped[prefix].units.push(file.name);
    }
});

const finalLessons = [];

Object.keys(coursesGrouped).forEach(prefix => {
    const group = coursesGrouped[prefix];
    
    group.masters.forEach(master => {
        let courseId = prefix;
        let name = master.replace('-master-', ' ').replace('.html', '');
        
        // Specialized mapping for known prepare.html IDs
        if (prefix === "00") {
             if (master.includes("getting-started")) courseId = "72uyaadl";
             else if (master.includes("ai-agents")) courseId = "ai-agents-vibe";
             else if (master.includes("wifi-motor")) courseId = "cvhofqxc";
             else if (master.includes("github-classroom")) courseId = "github-classroom-free";
        } else if (prefix === "basic-01") {
             courseId = "esp32-c3";
        } else if (prefix === "adv-01") {
             courseId = "esp32-s3";
        }
        
        // Filter units that BELONG to this master (same numeric group)
        finalLessons.push({
            courseId: courseId,
            classroomUrl: `/courses/${master}`,
            courseUnits: group.units,
            githubClassroomUrls: {} 
        });
    });
});

fs.writeFileSync('/Users/roverchen/Documents/web/vibe-coding-tw/functions/reconstructed_lessons.json', JSON.stringify(finalLessons, null, 2));
console.log(`Successfully reconstructed ${finalLessons.length} courses with shared units.`);
