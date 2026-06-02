const { Octokit } = require("@octokit/rest");

class GitHubAPIHelper {
    /**
     * @param {string} token - GitHub Personal Access Token
     */
    constructor(token) {
        if (!token) {
            throw new Error("GitHubAPIHelper requires a valid GitHub Personal Access Token.");
        }
        this.octokit = new Octokit({ auth: token });
    }

    _parseTemplateRepo(templateRepo) {
        let templateOwner = 'vibe-coding-classroom';
        let templateName = templateRepo;
        if (templateRepo.includes('/')) {
            const parts = templateRepo.split('/');
            templateOwner = parts[0];
            templateName = parts[1];
        }
        return { templateOwner, templateName };
    }

    async _getExistingRepo(orgName, newRepoName) {
        const existingRepo = await this.octokit.repos.get({
            owner: orgName,
            repo: newRepoName
        });
        return existingRepo.data;
    }

    async _getExistingRef(orgName, repoName, ref) {
        const existingRef = await this.octokit.git.getRef({
            owner: orgName,
            repo: repoName,
            ref: ref.replace('refs/', '')
        });
        return existingRef.data;
    }

    async _listOpenPullRequests(orgName, repoName, head, base) {
        const prs = await this.octokit.pulls.list({
            owner: orgName,
            repo: repoName,
            head: `${orgName}:${head}`,
            base: base,
            state: 'open'
        });
        return prs.data;
    }

    _isConflict(error, status, messageFragment) {
        return error?.status === status && String(error?.message || '').includes(messageFragment);
    }

    _logAndThrow(logMessage, error, thrownMessagePrefix) {
        console.error(`${logMessage}:`, error);
        throw new Error(`${thrownMessagePrefix}: ${error.message}`);
    }

    /**
     * Create a new repository from a template repository
     * @param {string} orgName - The organization to create the repository under
     * @param {string} templateRepo - The canonical template repository (e.g. "starter-vscode")
     * @param {string} newRepoName - The name of the student's new repository
     * @param {boolean} [isPrivate=true] - Whether the repository should be private
     * @returns {Promise<object>} - Created repository details
     */
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
            if (this._isConflict(error, 422, "Name already exists on this account")) {
                console.log(`[GitHubAPIHelper] Repository ${orgName}/${newRepoName} already exists on GitHub. Retrieving details...`);
                try {
                    return await this._getExistingRepo(orgName, newRepoName);
                } catch (getErr) {
                    console.error("Failed to retrieve existing repository details:", getErr);
                }
            }
            this._logAndThrow(`Error generating repo ${newRepoName} from template ${templateRepo}`, error, "Failed to generate repository");
        }
    }

    /**
     * Add a collaborator to the repository
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} username - Student's GitHub username
     * @param {string} [permission='push'] - Permission level (pull, push, admin)
     * @returns {Promise<object>} - Collaborator invitation details
     */
    async addCollaborator(orgName, repoName, username, permission = 'push') {
        try {
            const response = await this.octokit.repos.addCollaborator({
                owner: orgName,
                repo: repoName,
                username: username,
                permission: permission
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error adding collaborator ${username} to ${orgName}/${repoName}`, error, "Failed to add collaborator");
        }
    }

    /**
     * Remove a collaborator from the repository
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} username - Student's GitHub username
     * @returns {Promise<void>}
     */
    async removeCollaborator(orgName, repoName, username) {
        try {
            await this.octokit.repos.removeCollaborator({
                owner: orgName,
                repo: repoName,
                username: username
            });
        } catch (error) {
            this._logAndThrow(`Error removing collaborator ${username} from ${orgName}/${repoName}`, error, "Failed to remove collaborator");
        }
    }

    /**
     * Get reference (e.g. branch heads/main)
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} ref - Git reference (e.g., 'heads/main')
     * @returns {Promise<object>} - Git ref details containing SHA
     */
    async getRef(orgName, repoName, ref) {
        try {
            const response = await this.octokit.git.getRef({
                owner: orgName,
                repo: repoName,
                ref: ref
            });
            return response.data;
        } catch (error) {
            this._logAndThrow(`Error fetching ref ${ref} for ${orgName}/${repoName}`, error, "Failed to get git reference");
        }
    }

    /**
     * Create a new reference (branch)
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} ref - Fully qualified reference path (e.g., 'refs/heads/feedback')
     * @param {string} sha - The commit SHA to point the reference to
     * @returns {Promise<object>} - Created reference details
     */
    async createRef(orgName, repoName, ref, sha) {
        try {
            const response = await this.octokit.git.createRef({
                owner: orgName,
                repo: repoName,
                ref: ref,
                sha: sha
            });
            return response.data;
        } catch (error) {
            if (this._isConflict(error, 422, "Reference already exists")) {
                console.log(`[GitHubAPIHelper] Reference ${ref} already exists on ${orgName}/${repoName}. Retrieving existing ref...`);
                try {
                    return await this._getExistingRef(orgName, repoName, ref);
                } catch (getErr) {
                    console.error("Failed to retrieve existing ref details:", getErr);
                }
            }
            this._logAndThrow(`Error creating ref ${ref} on ${orgName}/${repoName}`, error, "Failed to create git reference");
        }
    }

    /**
     * Create a Pull Request
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} title - PR Title
     * @param {string} body - PR Body description
     * @param {string} head - The branch containing changes (e.g. 'main')
     * @param {string} base - The branch to merge into (e.g. 'feedback')
     * @returns {Promise<object>} - Created Pull Request details
     */
    async createPullRequest(orgName, repoName, title, body, head, base) {
        try {
            const response = await this.octokit.pulls.create({
                owner: orgName,
                repo: repoName,
                title: title,
                body: body,
                head: head,
                base: base
            });
            return response.data;
        } catch (error) {
            if (this._isConflict(error, 422, "A pull request already exists")) {
                console.log(`[GitHubAPIHelper] Pull request for ${head}->${base} already exists on ${orgName}/${repoName}. Retrieving existing PRs...`);
                try {
                    const prs = await this._listOpenPullRequests(orgName, repoName, head, base);
                    if (prs.length > 0) {
                        return prs[0];
                    }
                } catch (getErr) {
                    console.error("Failed to retrieve existing PR details:", getErr);
                }
            }
            this._logAndThrow(`Error creating PR ${title} on ${orgName}/${repoName}`, error, "Failed to create pull request");
        }
    }

    /**
     * Get a commit details
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} sha - The commit SHA
     * @returns {Promise<object>} - Commit details
     */
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

    /**
     * Create or update a file in the repository
     * @param {string} orgName - The organization owner
     * @param {string} repoName - The repository name
     * @param {string} path - The file path
     * @param {string} content - The file content
     * @param {string} message - Commit message
     * @param {string} branch - The branch name
     * @returns {Promise<object>} - Commit details
     */
    async createFile(orgName, repoName, path, content, message, branch) {
        try {
            const response = await this.octokit.repos.createOrUpdateFileContents({
                owner: orgName,
                repo: repoName,
                path: path,
                message: message,
                content: Buffer.from(content).toString('base64'),
                branch: branch
            });
            return response.data;
        } catch (error) {
            if (error.status === 409 || error.status === 422) {
                console.log(`[GitHubAPIHelper] File ${path} already exists or conflict on ${orgName}/${repoName}. Skipping...`);
                return null;
            }
            this._logAndThrow(`Error creating file ${path} on ${orgName}/${repoName}`, error, "Failed to create file");
        }
    }
}

module.exports = GitHubAPIHelper;
