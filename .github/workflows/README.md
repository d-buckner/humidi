# GitHub Actions Workflows

## Documentation Deployment

The `docs.yml` workflow automatically:

1. **Builds documentation** using TypeDoc from TSDoc comments
2. **Runs tests** to ensure code quality
3. **Preserves demo page** (`index.html`) and built library (`dist/`)
4. **Deploys to GitHub Pages** with both demo and docs

### Setup Required

To enable the documentation site, ensure GitHub Pages is configured:

1. Go to repository **Settings** → **Pages**
2. Set **Source** to "GitHub Actions"
3. The workflow will automatically deploy docs on pushes to `main`

### Accessing the Site

Once deployed, the site will have:

- **Demo**: https://d-buckner.github.io/humidi/ (interactive MIDI demo)
- **Documentation**: https://d-buckner.github.io/humidi/docs/ (complete API reference)

The documentation includes:
- Complete API reference
- Type definitions
- Usage examples
- Device management guides