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
            let templateOwner = 'vibe-coding-classroom';
            let templateName = templateRepo;
            if (templateRepo.includes('/')) {
                const parts = templateRepo.split('/');
                templateOwner = parts[0];
                templateName = parts[1];
            }

            const response = await this.octokit.repos.createUsingTemplate({
                template_owner: templateOwner,
                template_repo: templateName,
                owner: orgName,
                name: newRepoName,
                private: isPrivate
            });
            return response.data;
        } catch (error) {
            if (error.status === 422 && error.message.includes("Name already exists on this account")) {
                console.log(`[GitHubAPIHelper] Repository ${orgName}/${newRepoName} already exists on GitHub. Retrieving details...`);
                try {
                    const existingRepo = await this.octokit.repos.get({
                        owner: orgName,
                        repo: newRepoName
                    });
                    return existingRepo.data;
                } catch (getErr) {
                    console.error("Failed to retrieve existing repository details:", getErr);
                }
            }
            console.error(`Error generating repo ${newRepoName} from template ${templateRepo}:`, error);
            throw new Error(`Failed to generate repository: ${error.message}`);
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
            console.error(`Error adding collaborator ${username} to ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to add collaborator: ${error.message}`);
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
            console.error(`Error removing collaborator ${username} from ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to remove collaborator: ${error.message}`);
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
            console.error(`Error fetching ref ${ref} for ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to get git reference: ${error.message}`);
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
            if (error.status === 422 && error.message.includes("Reference already exists")) {
                console.log(`[GitHubAPIHelper] Reference ${ref} already exists on ${orgName}/${repoName}. Retrieving existing ref...`);
                try {
                    const existingRef = await this.octokit.git.getRef({
                        owner: orgName,
                        repo: repoName,
                        ref: ref.replace('refs/', '')
                    });
                    return existingRef.data;
                } catch (getErr) {
                    console.error("Failed to retrieve existing ref details:", getErr);
                }
            }
            console.error(`Error creating ref ${ref} on ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to create git reference: ${error.message}`);
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
            if (error.status === 422 && error.message.includes("A pull request already exists")) {
                console.log(`[GitHubAPIHelper] Pull request for ${head}->${base} already exists on ${orgName}/${repoName}. Retrieving existing PRs...`);
                try {
                    const prs = await this.octokit.pulls.list({
                        owner: orgName,
                        repo: repoName,
                        head: `${orgName}:${head}`,
                        base: base,
                        state: 'open'
                    });
                    if (prs.data.length > 0) {
                        return prs.data[0];
                    }
                } catch (getErr) {
                    console.error("Failed to retrieve existing PR details:", getErr);
                }
            }
            console.error(`Error creating PR ${title} on ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to create pull request: ${error.message}`);
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
            console.error(`Error fetching commit ${sha} for ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to get commit details: ${error.message}`);
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
            console.error(`Error creating file ${path} on ${orgName}/${repoName}:`, error);
            throw new Error(`Failed to create file: ${error.message}`);
        }
    }
}

module.exports = GitHubAPIHelper;
