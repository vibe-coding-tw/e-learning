const { Octokit } = require("@octokit/rest");
const logger = require("firebase-functions/logger");

class GitHubAPIHelper {
    constructor(token) {
        if (!token) {
            throw new Error("GitHubAPIHelper requires a valid GitHub Personal Access Token.");
        }
        this.octokit = new Octokit({ auth: token });
    }

    _parseTemplateRepo(templateRepo) {
        let templateOwner = "vibe-coding-classroom";
        let templateName = templateRepo;
        if (templateRepo.includes("/")) {
            const parts = templateRepo.split("/");
            templateOwner = parts[0];
            templateName = parts[1];
        }
        return { templateOwner, templateName };
    }

    _isConflict(error, status, messageFragment) {
        return error?.status === status && String(error?.message || "").includes(messageFragment);
    }

    _logAndThrow(logMessage, error, thrownMessagePrefix) {
        logger.error(`${logMessage}:`, error);
        throw new Error(`${thrownMessagePrefix}: ${error.message}`);
    }

    async createRepoFromTemplate(orgName, templateRepo, newRepoName, isPrivate = true) {
        try {
            const { templateOwner, templateName } = this._parseTemplateRepo(templateRepo);
            const response = await this.octokit.repos.createUsingTemplate({
                template_owner: templateOwner,
                template_repo: templateName,
                owner: orgName,
                name: newRepoName,
                private: isPrivate
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error generating repo ${newRepoName} from template ${templateRepo}`, error, "Failed to generate repository");
        }
    }

    async addCollaborator(orgName, repoName, username, permission = "push") {
        try {
            const response = await this.octokit.repos.addCollaborator({
                owner: orgName,
                repo: repoName,
                username,
                permission
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error adding collaborator ${username} to ${orgName}/${repoName}`, error, "Failed to add collaborator");
        }
    }

    async getRef(orgName, repoName, ref) {
        try {
            const response = await this.octokit.git.getRef({
                owner: orgName,
                repo: repoName,
                ref
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error fetching ref ${ref} for ${orgName}/${repoName}`, error, "Failed to get git reference");
        }
    }

    async createRef(orgName, repoName, ref, sha) {
        try {
            const response = await this.octokit.git.createRef({
                owner: orgName,
                repo: repoName,
                ref,
                sha
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error creating ref ${ref} on ${orgName}/${repoName}`, error, "Failed to create git reference");
        }
    }

    async getCommit(orgName, repoName, sha) {
        try {
            const response = await this.octokit.repos.getCommit({
                owner: orgName,
                repo: repoName,
                ref: sha
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error fetching commit ${sha} for ${orgName}/${repoName}`, error, "Failed to get commit details");
        }
    }

    async createPullRequest(orgName, repoName, title, body, head, base) {
        try {
            const response = await this.octokit.pulls.create({
                owner: orgName,
                repo: repoName,
                title,
                body,
                head,
                base
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error creating PR ${title} on ${orgName}/${repoName}`, error, "Failed to create pull request");
        }
    }

    async createFile(orgName, repoName, path, content, message, branch) {
        try {
            const response = await this.octokit.repos.createOrUpdateFileContents({
                owner: orgName,
                repo: repoName,
                path,
                message,
                content: Buffer.from(content).toString("base64"),
                branch
            });
            return response.data;
        } catch (error) {
            if (error.status === 409 || error.status === 422) {
                logger.info(`[GitHubAPIHelper] File ${path} already exists or conflict on ${orgName}/${repoName}. Skipping...`);
                return null;
            }
            this._logAndThrow(`Error creating file ${path} on ${orgName}/${repoName}`, error, "Failed to create file");
        }
    }
}

module.exports = GitHubAPIHelper;
