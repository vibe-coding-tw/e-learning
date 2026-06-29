"use strict";
const admin = require("firebase-admin");
const { registerProxyExports } = require('./index-export-utils');
const { gradeAssignment } = require("./assignment-flow");

const registerAutogradeExports = ({ target, proxyAutogradeCallable, proxyAutogradeRequest, onCall }) => {
    registerProxyExports(target, [
        ["submitAssignment", "autogradeSubmitAssignment"],
        ["submitStudentBlocker", "autogradeSubmitStudentBlocker"],
        ["submitAttemptSummary", "autogradeSubmitAttemptSummary"],
        ["resolveStudentBlocker", "autogradeResolveStudentBlocker"],
        ["submitTutorCoachingLog", "autogradeSubmitTutorCoachingLog"],
        ["createStudentRepository", "autogradeCreateStudentRepository"],
        ["testGithubToken", "autogradeTestGithubToken"]
    ], proxyAutogradeCallable);

    target.gradeAssignment = onCall(async (request) => {
        const { data, auth } = request;
        const db = admin.firestore();
        return gradeAssignment(db, {
            graderUid: auth?.uid,
            assignmentId: data.assignmentId,
            grade: data.grade,
            feedback: data.feedback
        });
    });

    registerProxyExports(target, [
        ["ingestGithubAutograde", "autogradeIngestGithubAutograde"]
    ], proxyAutogradeRequest);
};

module.exports = {
    registerAutogradeExports
};
