#!/usr/bin/env node
/* eslint-disable no-console */

require('dotenv').config();
const GitHubAPIHelper = require('../github-api-helper');

async function testConnection() {
  const token = process.env.GITHUB_API_TOKEN;
  if (!token || token === 'your_github_token_here') {
    console.error('❌ GITHUB_API_TOKEN is not configured in functions/.env');
    console.log('Please replace GITHUB_API_TOKEN with a valid Personal Access Token (PAT).');
    process.exit(1);
  }

  console.log('Testing GitHub API connection...');
  try {
    const helper = new GitHubAPIHelper(token);
    const authUserResponse = await helper.octokit.users.getAuthenticated();
    const user = authUserResponse.data;
    console.log(`✅ Success! Authenticated as: ${user.login} (${user.name || 'No Name'})`);
    console.log(`Token scopes/capabilities: ${authUserResponse.headers['x-oauth-scopes'] || 'unknown'}`);
    
    // Check if user wants to run E2E test
    if (process.argv.includes('--e2e')) {
      const org = process.argv[process.argv.indexOf('--e2e') + 1] || 'vibe-coding-classroom';
      const templateRepo = process.argv[process.argv.indexOf('--e2e') + 2] || 'starter-vscode';
      console.log(`\nStarting E2E test in organization: ${org} using template: ${templateRepo}...`);
      
      const testRepoName = `test-api-run-${Date.now()}`;
      console.log(`Step 1: Creating repository ${testRepoName} from template...`);
      const repo = await helper.createRepoFromTemplate(org, templateRepo, testRepoName, true);
      console.log(`✅ Created: ${repo.html_url}`);

      // We add a collaborator if username is supplied
      const testUser = process.argv[process.argv.indexOf('--user') + 1];
      if (testUser) {
        console.log(`Step 2: Adding collaborator ${testUser}...`);
        const invite = await helper.addCollaborator(org, testRepoName, testUser, 'push');
        console.log(`✅ Collaborator invitation sent! URL: ${invite.html_url}`);
      } else {
        console.log('Step 2: Skipping collaborator invite (pass --user <username> to test)');
      }

      console.log('Step 3: Creating feedback branch...');
      // To create a branch, we need the SHA of the main branch. Let's fetch main first.
      console.log('Fetching main branch ref...');
      const mainRef = await helper.getRef(org, testRepoName, 'heads/main');
      const mainSha = mainRef.object.sha;
      console.log(`Main branch SHA: ${mainSha}`);

      console.log('Creating refs/heads/feedback...');
      const feedbackRef = await helper.createRef(org, testRepoName, 'refs/heads/feedback', mainSha);
      console.log(`✅ Ref created: ${feedbackRef.ref}`);

      console.log('Step 4: Creating Pull Request (main -> feedback)...');
      const pr = await helper.createPullRequest(
        org,
        testRepoName,
        'classroom-feedback',
        'Testing PR creation automations.\n\nDo not merge.',
        'main',
        'feedback'
      );
      console.log(`✅ Pull Request created! URL: ${pr.html_url}`);
      
      console.log('\n🎉 E2E test completed successfully!');
    } else {
      console.log('\nTo run a full repository E2E creation test, run:');
      console.log('  node scripts/test-github-api.js --e2e <org_name> <template_repo_name>');
      console.log('Optionally invite a collaborator:');
      console.log('  node scripts/test-github-api.js --e2e <org_name> <template_repo_name> --user <github_username>');
    }
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

testConnection();
