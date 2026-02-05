const fs = require('fs');
const path = require('path');

try {
    const lessonsPath = path.join(__dirname, 'public/lessons.json');
    const lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf8'));
    console.log("JSON parsed successfully.");

    const targetId = 'cvhofqxc';
    const course = lessons.find(l => l.courseId === targetId);

    if (course) {
        console.log(`Found course: ${course.title}`);
        console.log(`Price: ${course.price}`);
        console.log(`URL: ${course.classroomUrl}`);
        if (course.price === 0) {
            console.log("VERIFICATION SUCCESS: Course is free and configured correctly.");
        } else {
            console.error("VERIFICATION FAILED: Course price is not 0.");
            process.exit(1);
        }
    } else {
        console.error(`VERIFICATION FAILED: Course ID ${targetId} not found.`);
        process.exit(1);
    }

} catch (e) {
    console.error("JSON Error:", e.message);
    process.exit(1);
}
