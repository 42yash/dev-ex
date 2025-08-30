"""
Git Agent - Handles version control operations
"""

import os
import json
import logging
import subprocess
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import asyncio
from datetime import datetime
import re

from .base import BaseAgent, AgentContext, AgentStatus, AgentType
from .execution_limiter import ExecutionLimiter
from ..config import Config

logger = logging.getLogger(__name__)


class GitOperation(Enum):
    """Supported Git operations"""
    INIT = "init"
    ADD = "add"
    COMMIT = "commit"
    PUSH = "push"
    PULL = "pull"
    BRANCH = "branch"
    CHECKOUT = "checkout"
    MERGE = "merge"
    STATUS = "status"
    LOG = "log"
    DIFF = "diff"
    CLONE = "clone"
    TAG = "tag"
    STASH = "stash"


class CommitType(Enum):
    """Conventional commit types"""
    FEAT = "feat"        # New feature
    FIX = "fix"          # Bug fix
    DOCS = "docs"        # Documentation
    STYLE = "style"      # Code style changes
    REFACTOR = "refactor"  # Code refactoring
    TEST = "test"        # Tests
    CHORE = "chore"      # Maintenance
    PERF = "perf"        # Performance improvements
    CI = "ci"            # CI/CD changes
    BUILD = "build"      # Build system changes
    REVERT = "revert"    # Revert previous commit


@dataclass
class GitRepository:
    """Git repository information"""
    path: str
    remote_url: Optional[str] = None
    current_branch: str = "main"
    is_initialized: bool = False
    has_changes: bool = False
    commits_ahead: int = 0
    commits_behind: int = 0


@dataclass
class GitCommit:
    """Git commit information"""
    hash: str
    author: str
    date: datetime
    message: str
    files_changed: List[str] = field(default_factory=list)
    insertions: int = 0
    deletions: int = 0


class GitAgent(BaseAgent):
    """
    Agent responsible for Git version control operations
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None):
        super().__init__(
            name="git_agent",
            agent_type=AgentType.CODE,
            system_prompt="""You are a Git Version Control Agent. Your role is to manage 
            Git repositories, create meaningful commits, handle branches, and ensure proper 
            version control practices. You follow conventional commit standards and maintain 
            clean Git history.""",
            model=None,
            config={}
        )
        self.config = config
        self.execution_limiter = execution_limiter
        self.repositories: Dict[str, GitRepository] = {}
    
    async def _run_git_command(self, command: List[str], cwd: str = ".") -> Tuple[bool, str, str]:
        """Run a Git command and return success, stdout, stderr"""
        try:
            result = await asyncio.create_subprocess_exec(
                "git", *command,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            
            success = result.returncode == 0
            return success, stdout.decode().strip(), stderr.decode().strip()
            
        except Exception as e:
            logger.error(f"Error running git command {command}: {str(e)}")
            return False, "", str(e)
    
    async def initialize_repository(self, path: str, initial_branch: str = "main") -> Dict[str, Any]:
        """Initialize a new Git repository"""
        logger.info(f"Initializing Git repository at {path}")
        
        # Create directory if it doesn't exist
        Path(path).mkdir(parents=True, exist_ok=True)
        
        # Initialize repository
        success, stdout, stderr = await self._run_git_command(["init"], cwd=path)
        if not success:
            return {"status": "error", "message": f"Failed to initialize repository: {stderr}"}
        
        # Set initial branch name
        await self._run_git_command(["branch", "-M", initial_branch], cwd=path)
        
        # Create initial .gitignore
        gitignore_content = """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv
pip-log.txt
pip-delete-this-directory.txt

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Environment
.env
.env.local
*.local

# Build
dist/
build/
*.egg-info/

# Testing
.coverage
htmlcov/
.pytest_cache/
coverage/

# Logs
*.log
logs/

# Database
*.db
*.sqlite3

# Temporary
tmp/
temp/
"""
        
        gitignore_path = Path(path) / ".gitignore"
        gitignore_path.write_text(gitignore_content)
        
        # Add and commit .gitignore
        await self._run_git_command(["add", ".gitignore"], cwd=path)
        await self._run_git_command(
            ["commit", "-m", "Initial commit: Add .gitignore"],
            cwd=path
        )
        
        # Store repository info
        repo = GitRepository(
            path=path,
            current_branch=initial_branch,
            is_initialized=True
        )
        self.repositories[path] = repo
        
        logger.info(f"Repository initialized successfully at {path}")
        return {
            "status": "success",
            "path": path,
            "branch": initial_branch,
            "message": "Repository initialized successfully"
        }
    
    async def add_files(self, repo_path: str, files: List[str] = None) -> Dict[str, Any]:
        """Add files to staging area"""
        logger.info(f"Adding files to repository at {repo_path}")
        
        if files is None:
            # Add all files
            success, stdout, stderr = await self._run_git_command(["add", "."], cwd=repo_path)
        else:
            # Add specific files
            success, stdout, stderr = await self._run_git_command(["add"] + files, cwd=repo_path)
        
        if not success:
            return {"status": "error", "message": f"Failed to add files: {stderr}"}
        
        # Get status to show what was added
        status = await self.get_status(repo_path)
        
        return {
            "status": "success",
            "staged_files": status.get("staged", []),
            "message": "Files added to staging area"
        }
    
    async def create_commit(self, repo_path: str, message: str, 
                          commit_type: Optional[CommitType] = None,
                          scope: Optional[str] = None,
                          body: Optional[str] = None,
                          breaking_change: bool = False) -> Dict[str, Any]:
        """Create a Git commit with conventional commit format"""
        logger.info(f"Creating commit in repository at {repo_path}")
        
        # Format commit message
        if commit_type:
            # Use conventional commit format
            commit_msg = f"{commit_type.value}"
            if scope:
                commit_msg += f"({scope})"
            if breaking_change:
                commit_msg += "!"
            commit_msg += f": {message}"
            
            if body:
                commit_msg += f"\n\n{body}"
            
            if breaking_change:
                commit_msg += "\n\nBREAKING CHANGE: This commit contains breaking changes"
        else:
            commit_msg = message
        
        # Create commit
        success, stdout, stderr = await self._run_git_command(
            ["commit", "-m", commit_msg],
            cwd=repo_path
        )
        
        if not success:
            if "nothing to commit" in stderr or "nothing to commit" in stdout:
                return {"status": "info", "message": "Nothing to commit, working tree clean"}
            return {"status": "error", "message": f"Failed to create commit: {stderr}"}
        
        # Get commit info
        success, commit_hash, _ = await self._run_git_command(
            ["rev-parse", "HEAD"],
            cwd=repo_path
        )
        
        return {
            "status": "success",
            "commit_hash": commit_hash[:7],
            "message": commit_msg,
            "timestamp": datetime.now().isoformat()
        }
    
    async def create_branch(self, repo_path: str, branch_name: str, 
                          checkout: bool = True) -> Dict[str, Any]:
        """Create a new branch"""
        logger.info(f"Creating branch {branch_name} in repository at {repo_path}")
        
        # Create branch
        if checkout:
            success, stdout, stderr = await self._run_git_command(
                ["checkout", "-b", branch_name],
                cwd=repo_path
            )
        else:
            success, stdout, stderr = await self._run_git_command(
                ["branch", branch_name],
                cwd=repo_path
            )
        
        if not success:
            if "already exists" in stderr:
                return {"status": "error", "message": f"Branch {branch_name} already exists"}
            return {"status": "error", "message": f"Failed to create branch: {stderr}"}
        
        # Update repository info
        if repo_path in self.repositories and checkout:
            self.repositories[repo_path].current_branch = branch_name
        
        return {
            "status": "success",
            "branch": branch_name,
            "checked_out": checkout,
            "message": f"Branch {branch_name} created successfully"
        }
    
    async def checkout_branch(self, repo_path: str, branch_name: str) -> Dict[str, Any]:
        """Checkout an existing branch"""
        logger.info(f"Checking out branch {branch_name} in repository at {repo_path}")
        
        success, stdout, stderr = await self._run_git_command(
            ["checkout", branch_name],
            cwd=repo_path
        )
        
        if not success:
            return {"status": "error", "message": f"Failed to checkout branch: {stderr}"}
        
        # Update repository info
        if repo_path in self.repositories:
            self.repositories[repo_path].current_branch = branch_name
        
        return {
            "status": "success",
            "branch": branch_name,
            "message": f"Switched to branch {branch_name}"
        }
    
    async def merge_branch(self, repo_path: str, source_branch: str, 
                          strategy: str = "recursive") -> Dict[str, Any]:
        """Merge a branch into current branch"""
        logger.info(f"Merging branch {source_branch} in repository at {repo_path}")
        
        # Get current branch
        success, current_branch, _ = await self._run_git_command(
            ["rev-parse", "--abbrev-ref", "HEAD"],
            cwd=repo_path
        )
        
        if not success:
            return {"status": "error", "message": "Failed to get current branch"}
        
        # Perform merge
        success, stdout, stderr = await self._run_git_command(
            ["merge", source_branch, "--strategy", strategy],
            cwd=repo_path
        )
        
        if not success:
            if "CONFLICT" in stdout or "CONFLICT" in stderr:
                # Get conflict files
                success, conflicts, _ = await self._run_git_command(
                    ["diff", "--name-only", "--diff-filter=U"],
                    cwd=repo_path
                )
                
                return {
                    "status": "conflict",
                    "message": "Merge conflicts detected",
                    "conflicts": conflicts.split("\n") if conflicts else [],
                    "resolution_needed": True
                }
            return {"status": "error", "message": f"Failed to merge: {stderr}"}
        
        return {
            "status": "success",
            "message": f"Successfully merged {source_branch} into {current_branch}",
            "target_branch": current_branch,
            "source_branch": source_branch
        }
    
    async def get_status(self, repo_path: str) -> Dict[str, Any]:
        """Get repository status"""
        logger.info(f"Getting status for repository at {repo_path}")
        
        # Get porcelain status for parsing
        success, stdout, stderr = await self._run_git_command(
            ["status", "--porcelain"],
            cwd=repo_path
        )
        
        if not success:
            return {"status": "error", "message": f"Failed to get status: {stderr}"}
        
        # Parse status
        staged = []
        modified = []
        untracked = []
        deleted = []
        
        for line in stdout.split("\n"):
            if not line:
                continue
            
            status_code = line[:2]
            file_path = line[3:]
            
            if status_code[0] == "A":
                staged.append(file_path)
            elif status_code[0] == "M":
                staged.append(file_path)
            elif status_code[1] == "M":
                modified.append(file_path)
            elif status_code == "??":
                untracked.append(file_path)
            elif status_code[0] == "D" or status_code[1] == "D":
                deleted.append(file_path)
        
        # Get current branch
        success, current_branch, _ = await self._run_git_command(
            ["rev-parse", "--abbrev-ref", "HEAD"],
            cwd=repo_path
        )
        
        return {
            "status": "success",
            "branch": current_branch if success else "unknown",
            "staged": staged,
            "modified": modified,
            "untracked": untracked,
            "deleted": deleted,
            "clean": not (staged or modified or untracked or deleted)
        }
    
    async def get_log(self, repo_path: str, limit: int = 10, 
                     oneline: bool = False) -> Dict[str, Any]:
        """Get commit log"""
        logger.info(f"Getting commit log for repository at {repo_path}")
        
        if oneline:
            cmd = ["log", f"--oneline", f"-{limit}"]
        else:
            cmd = ["log", f"-{limit}", "--pretty=format:%H|%an|%ae|%ad|%s", "--date=iso"]
        
        success, stdout, stderr = await self._run_git_command(cmd, cwd=repo_path)
        
        if not success:
            return {"status": "error", "message": f"Failed to get log: {stderr}"}
        
        if oneline:
            commits = stdout.split("\n") if stdout else []
        else:
            commits = []
            for line in stdout.split("\n"):
                if not line:
                    continue
                parts = line.split("|")
                if len(parts) >= 5:
                    commits.append({
                        "hash": parts[0][:7],
                        "author": parts[1],
                        "email": parts[2],
                        "date": parts[3],
                        "message": parts[4]
                    })
        
        return {
            "status": "success",
            "commits": commits,
            "count": len(commits)
        }
    
    async def create_tag(self, repo_path: str, tag_name: str, 
                        message: Optional[str] = None,
                        annotated: bool = True) -> Dict[str, Any]:
        """Create a Git tag"""
        logger.info(f"Creating tag {tag_name} in repository at {repo_path}")
        
        if annotated and message:
            cmd = ["tag", "-a", tag_name, "-m", message]
        else:
            cmd = ["tag", tag_name]
        
        success, stdout, stderr = await self._run_git_command(cmd, cwd=repo_path)
        
        if not success:
            if "already exists" in stderr:
                return {"status": "error", "message": f"Tag {tag_name} already exists"}
            return {"status": "error", "message": f"Failed to create tag: {stderr}"}
        
        return {
            "status": "success",
            "tag": tag_name,
            "annotated": annotated,
            "message": f"Tag {tag_name} created successfully"
        }
    
    async def push_to_remote(self, repo_path: str, remote: str = "origin", 
                            branch: Optional[str] = None,
                            tags: bool = False) -> Dict[str, Any]:
        """Push to remote repository"""
        logger.info(f"Pushing to remote {remote} from repository at {repo_path}")
        
        if tags:
            cmd = ["push", remote, "--tags"]
        elif branch:
            cmd = ["push", remote, branch]
        else:
            cmd = ["push", remote]
        
        success, stdout, stderr = await self._run_git_command(cmd, cwd=repo_path)
        
        if not success:
            if "no upstream branch" in stderr:
                # Try to set upstream
                success, current_branch, _ = await self._run_git_command(
                    ["rev-parse", "--abbrev-ref", "HEAD"],
                    cwd=repo_path
                )
                if success:
                    success, stdout, stderr = await self._run_git_command(
                        ["push", "--set-upstream", remote, current_branch],
                        cwd=repo_path
                    )
                    if success:
                        return {
                            "status": "success",
                            "message": f"Pushed to {remote} and set upstream"
                        }
            
            return {"status": "error", "message": f"Failed to push: {stderr}"}
        
        return {
            "status": "success",
            "remote": remote,
            "message": f"Successfully pushed to {remote}"
        }
    
    async def clone_repository(self, remote_url: str, target_path: str,
                              branch: Optional[str] = None) -> Dict[str, Any]:
        """Clone a remote repository"""
        logger.info(f"Cloning repository from {remote_url} to {target_path}")
        
        cmd = ["clone", remote_url, target_path]
        if branch:
            cmd.extend(["-b", branch])
        
        success, stdout, stderr = await self._run_git_command(cmd)
        
        if not success:
            return {"status": "error", "message": f"Failed to clone: {stderr}"}
        
        # Store repository info
        repo = GitRepository(
            path=target_path,
            remote_url=remote_url,
            current_branch=branch or "main",
            is_initialized=True
        )
        self.repositories[target_path] = repo
        
        return {
            "status": "success",
            "path": target_path,
            "remote_url": remote_url,
            "message": "Repository cloned successfully"
        }
    
    def generate_commit_message(self, changes: Dict[str, Any]) -> str:
        """Generate a conventional commit message based on changes"""
        files_changed = changes.get("files", [])
        change_type = changes.get("type", "update")
        description = changes.get("description", "")
        
        # Determine commit type
        if change_type == "feature":
            commit_type = CommitType.FEAT
        elif change_type == "bugfix":
            commit_type = CommitType.FIX
        elif change_type == "documentation":
            commit_type = CommitType.DOCS
        elif change_type == "refactor":
            commit_type = CommitType.REFACTOR
        elif change_type == "test":
            commit_type = CommitType.TEST
        elif change_type == "performance":
            commit_type = CommitType.PERF
        else:
            commit_type = CommitType.CHORE
        
        # Determine scope
        scope = None
        if files_changed:
            # Extract common directory as scope
            if len(files_changed) == 1:
                path_parts = files_changed[0].split("/")
                if len(path_parts) > 1:
                    scope = path_parts[0]
            else:
                # Find common prefix
                common_parts = files_changed[0].split("/")
                for file in files_changed[1:]:
                    parts = file.split("/")
                    common_parts = [p for i, p in enumerate(common_parts) 
                                  if i < len(parts) and parts[i] == p]
                if common_parts:
                    scope = common_parts[0]
        
        # Generate message
        message = f"{commit_type.value}"
        if scope:
            message += f"({scope})"
        message += f": {description or 'Update files'}"
        
        return message
    
    async def execute(self, input_data: str, context: AgentContext) -> Dict[str, Any]:
        """Execute Git operations based on input"""
        logger.info(f"Git agent executing for session {context.session_id}")
        
        try:
            # Parse input
            if isinstance(input_data, str):
                try:
                    data = json.loads(input_data)
                except:
                    data = {"operation": "status", "path": input_data}
            else:
                data = input_data
            
            operation = data.get("operation", GitOperation.STATUS.value)
            repo_path = data.get("path", ".")
            
            # Execute operation
            if operation == GitOperation.INIT.value:
                result = await self.initialize_repository(
                    repo_path,
                    data.get("branch", "main")
                )
            
            elif operation == GitOperation.ADD.value:
                result = await self.add_files(
                    repo_path,
                    data.get("files")
                )
            
            elif operation == GitOperation.COMMIT.value:
                result = await self.create_commit(
                    repo_path,
                    data.get("message", "Update files"),
                    CommitType[data.get("type", "CHORE").upper()] if data.get("type") else None,
                    data.get("scope"),
                    data.get("body"),
                    data.get("breaking_change", False)
                )
            
            elif operation == GitOperation.BRANCH.value:
                result = await self.create_branch(
                    repo_path,
                    data.get("name"),
                    data.get("checkout", True)
                )
            
            elif operation == GitOperation.CHECKOUT.value:
                result = await self.checkout_branch(
                    repo_path,
                    data.get("branch")
                )
            
            elif operation == GitOperation.MERGE.value:
                result = await self.merge_branch(
                    repo_path,
                    data.get("source_branch"),
                    data.get("strategy", "recursive")
                )
            
            elif operation == GitOperation.STATUS.value:
                result = await self.get_status(repo_path)
            
            elif operation == GitOperation.LOG.value:
                result = await self.get_log(
                    repo_path,
                    data.get("limit", 10),
                    data.get("oneline", False)
                )
            
            elif operation == GitOperation.PUSH.value:
                result = await self.push_to_remote(
                    repo_path,
                    data.get("remote", "origin"),
                    data.get("branch"),
                    data.get("tags", False)
                )
            
            elif operation == GitOperation.CLONE.value:
                result = await self.clone_repository(
                    data.get("url"),
                    data.get("target_path"),
                    data.get("branch")
                )
            
            elif operation == GitOperation.TAG.value:
                result = await self.create_tag(
                    repo_path,
                    data.get("name"),
                    data.get("message"),
                    data.get("annotated", True)
                )
            
            else:
                result = {
                    "status": "error",
                    "message": f"Unknown operation: {operation}"
                }
            
            # Store result in context
            context.variables["git_result"] = result
            
            return result
            
        except Exception as e:
            logger.error(f"Error in Git agent: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }