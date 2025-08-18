#!/bin/bash

# Release script for mac-chrome-cli
# This script helps prepare and publish new releases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're on main branch
check_branch() {
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        log_error "Must be on main branch to create a release. Current branch: $current_branch"
        exit 1
    fi
    log_success "On main branch"
}

# Check if working directory is clean
check_clean() {
    if [ -n "$(git status --porcelain)" ]; then
        log_error "Working directory is not clean. Please commit or stash changes."
        git status --short
        exit 1
    fi
    log_success "Working directory is clean"
}

# Check if up to date with remote
check_remote() {
    git fetch origin
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/main)
    
    if [ "$local_commit" != "$remote_commit" ]; then
        log_error "Local branch is not up to date with origin/main"
        exit 1
    fi
    log_success "Up to date with remote"
}

# Run tests and validation
run_validation() {
    log_info "Running validation..."
    npm run validate
    log_success "Validation passed"
}

# Build for production
build_production() {
    log_info "Building for production..."
    npm run build:prod
    log_success "Production build completed"
}

# Test package installation
test_package() {
    log_info "Testing package installation..."
    
    # Create package
    npm run pack:test
    
    # Install globally and test
    local package_file=$(ls mac-chrome-cli-*.tgz | head -1)
    npm install -g "./$package_file"
    
    # Test basic functionality
    if mac-chrome-cli --version && mac-chrome-cli test; then
        log_success "Package installation test passed"
    else
        log_error "Package installation test failed"
        npm uninstall -g mac-chrome-cli
        rm -f mac-chrome-cli-*.tgz
        exit 1
    fi
    
    # Cleanup
    npm uninstall -g mac-chrome-cli
    rm -f mac-chrome-cli-*.tgz
}

# Get version type from user input
get_version_type() {
    if [ -n "$1" ]; then
        echo "$1"
        return
    fi
    
    echo "Select version bump type:"
    echo "1) patch (1.0.0 -> 1.0.1)"
    echo "2) minor (1.0.0 -> 1.1.0)"
    echo "3) major (1.0.0 -> 2.0.0)"
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1) echo "patch" ;;
        2) echo "minor" ;;
        3) echo "major" ;;
        *) 
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

# Create release
create_release() {
    local version_type=$1
    
    log_info "Creating $version_type release..."
    
    # Get current version
    local current_version=$(node -p "require('./package.json').version")
    log_info "Current version: $current_version"
    
    # Bump version
    npm version "$version_type" --no-git-tag-version
    local new_version=$(node -p "require('./package.json').version")
    log_info "New version: $new_version"
    
    # Commit and tag
    git add package.json
    git commit -m "chore: bump version to v$new_version"
    git tag "v$new_version"
    
    log_success "Created release v$new_version"
    
    # Ask if user wants to push
    read -p "Push to remote and trigger release? (y/N): " push_confirm
    if [[ $push_confirm =~ ^[Yy]$ ]]; then
        git push origin main
        git push origin "v$new_version"
        log_success "Pushed to remote. GitHub Actions will handle the release."
    else
        log_warning "Not pushed to remote. Run 'git push origin main && git push origin v$new_version' to trigger release."
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [version_type]"
    echo ""
    echo "Create a new release for mac-chrome-cli"
    echo ""
    echo "Arguments:"
    echo "  version_type    Optional. One of: patch, minor, major"
    echo ""
    echo "Examples:"
    echo "  $0              # Interactive mode"
    echo "  $0 patch        # Create patch release"
    echo "  $0 minor        # Create minor release"
    echo "  $0 major        # Create major release"
}

# Main function
main() {
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
        exit 0
    fi
    
    log_info "Starting release process for mac-chrome-cli"
    
    # Pre-release checks
    check_branch
    check_clean
    check_remote
    
    # Validation and testing
    run_validation
    build_production
    test_package
    
    # Get version type and create release
    local version_type=$(get_version_type "$1")
    create_release "$version_type"
    
    log_success "Release process completed!"
}

# Run main function with all arguments
main "$@"