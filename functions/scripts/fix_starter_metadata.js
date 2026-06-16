const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const UPDATES = {
  "car-starter-web-app.html": {
    orderWeight: 1,
    lessonLabel: "第 1 課",
    lessonLabelEn: "Lesson 1",
    courseUnits: ["car-starter-html5-basics.html", "car-starter-flexbox-layout.html", "car-starter-ui-ux-standards.html"],
    course_units: ["car-starter-html5-basics.html", "car-starter-flexbox-layout.html", "car-starter-ui-ux-standards.html"],
    courseUnitTitles: ["HTML5 Basics", "Flexbox Layout", "UI UX Standards"],
    course_unit_titles: ["HTML5 Basics", "Flexbox Layout", "UI UX Standards"],
    entryUnitId: "car-starter-html5-basics.html",
    classroomUrl: "/courses/car-starter-html5-basics.html",
    i18n: {
      "zh-TW": {
        lessonLabel: "第 1 課"
      },
      "en": {
        lessonLabel: "Lesson 1"
      }
    }
  },
  "car-starter-touch-events.html": {
    orderWeight: 2,
    lessonLabel: "第 2 課",
    lessonLabelEn: "Lesson 2",
    courseUnits: ["car-starter-touch-basics.html", "car-starter-prevent-default.html", "car-starter-long-press.html"],
    course_units: ["car-starter-touch-basics.html", "car-starter-prevent-default.html", "car-starter-long-press.html"],
    courseUnitTitles: ["Touch Basics", "Prevent Default", "Long Press"],
    course_unit_titles: ["Touch Basics", "Prevent Default", "Long Press"],
    entryUnitId: "car-starter-touch-basics.html",
    classroomUrl: "/courses/car-starter-touch-basics.html",
    i18n: {
      "zh-TW": {
        lessonLabel: "第 2 課"
      },
      "en": {
        lessonLabel: "Lesson 2"
      }
    }
  },
  "car-starter-joystick-lab.html": {
    orderWeight: 3,
    lessonLabel: "第 3 課",
    lessonLabelEn: "Lesson 3",
    courseUnits: ["car-starter-touch-vs-mouse.html", "car-starter-canvas-joystick.html", "car-starter-joystick-math.html"],
    course_units: ["car-starter-touch-vs-mouse.html", "car-starter-canvas-joystick.html", "car-starter-joystick-math.html"],
    courseUnitTitles: ["Touch Vs Mouse", "Canvas Joystick", "Joystick Math"],
    course_unit_titles: ["Touch Vs Mouse", "Canvas Joystick", "Joystick Math"],
    entryUnitId: "car-starter-touch-vs-mouse.html",
    classroomUrl: "/courses/car-starter-touch-vs-mouse.html",
    i18n: {
      "zh-TW": {
        lessonLabel: "第 3 課"
      },
      "en": {
        lessonLabel: "Lesson 3"
      }
    }
  },
  "car-starter-remote-control.html": {
    orderWeight: 4,
    lessonLabel: "第 4 課",
    lessonLabelEn: "Lesson 4",
    courseUnits: ["car-starter-control-panel.html", "car-starter-flow-logic.html", "car-starter-data-json.html"],
    course_units: ["car-starter-control-panel.html", "car-starter-flow-logic.html", "car-starter-data-json.html"],
    courseUnitTitles: ["Control Panel", "Flow Logic", "Data JSON"],
    course_unit_titles: ["Control Panel", "Flow Logic", "Data JSON"],
    entryUnitId: "car-starter-control-panel.html",
    classroomUrl: "/courses/car-starter-control-panel.html",
    i18n: {
      "zh-TW": {
        lessonLabel: "第 4 課"
      },
      "en": {
        lessonLabel: "Lesson 4"
      }
    }
  },
  "car-starter-web-ble.html": {
    orderWeight: 5,
    lessonLabel: "第 5 課",
    lessonLabelEn: "Lesson 5",
    courseUnits: ["car-starter-typed-arrays.html", "car-starter-ble-async.html", "car-starter-ble-security.html"],
    course_units: ["car-starter-typed-arrays.html", "car-starter-ble-async.html", "car-starter-ble-security.html"],
    courseUnitTitles: ["Typed Arrays", "BLE Async", "BLE Security"],
    course_unit_titles: ["Typed Arrays", "BLE Async", "BLE Security"],
    entryUnitId: "car-starter-typed-arrays.html",
    classroomUrl: "/courses/car-starter-typed-arrays.html",
    i18n: {
      "zh-TW": {
        lessonLabel: "第 5 課"
      },
      "en": {
        lessonLabel: "Lesson 5"
      }
    }
  }
};

async function main() {
  for (const [docId, fields] of Object.entries(UPDATES)) {
    const docRef = db.collection("metadata_lessons").doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.log(`Document ${docId} does not exist. Skipping.`);
      continue;
    }
    
    console.log(`Updating ${docId}...`);
    await docRef.set(fields, { merge: true });
  }
  console.log("Update completed.");
}

main().catch(err => {
  console.error("Error updating production database:", err);
  process.exit(1);
});
