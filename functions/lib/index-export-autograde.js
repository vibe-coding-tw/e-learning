const { registerProxyExports } = require('./index-export-utils');

const registerAutogradeExports = ({ target, proxyAutogradeCallable, proxyAutogradeRequest, onCall, HttpsError }) => {
    registerProxyExports(target, [
        ["submitAssignment", "autogradeSubmitAssignment"],
        ["submitStudentBlocker", "autogradeSubmitStudentBlocker"],
        ["submitAttemptSummary", "autogradeSubmitAttemptSummary"],
        ["resolveStudentBlocker", "autogradeResolveStudentBlocker"],
        ["submitTutorCoachingLog", "autogradeSubmitTutorCoachingLog"],
        ["createStudentRepository", "autogradeCreateStudentRepository"],
        ["testGithubToken", "autogradeTestGithubToken"]
    ], proxyAutogradeCallable);

    target.gradeAssignment = onCall(async () => {
        throw new HttpsError(
            'failed-precondition',
            'Manual grading has been removed. Please use GitHub autograde sync.'
        );
    });

    registerProxyExports(target, [
        ["ingestGithubAutograde", "autogradeIngestGithubAutograde"]
    ], proxyAutogradeRequest);
};

module.exports = {
    registerAutogradeExports
};
