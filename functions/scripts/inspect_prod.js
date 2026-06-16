const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('metadata_lessons').get();
  console.log(`Found ${snapshot.size} documents in production metadata_lessons:`);
  const courses = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (doc.id.includes('car-starter') && data.hiddenFromCatalog !== true) {
      courses.push({
        id: doc.id,
        title: data.title,
        orderWeight: data.orderWeight,
        courseUnits: data.courseUnits,
        course_units: data.course_units,
        courseUnitTitles: data.courseUnitTitles,
        course_unit_titles: data.course_unit_titles
      });
    }
  }
  courses.sort((a, b) => a.orderWeight - b.orderWeight);
  console.log(JSON.stringify(courses, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
