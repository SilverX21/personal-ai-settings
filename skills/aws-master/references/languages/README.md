# Language-specific AWS development references

These files contain implementation guidance for applications that consume AWS services.

The core `aws-master` skill is programming-language agnostic. Load a language file only when code, SDK usage, framework integration, or language-specific credential behavior is relevant.

Current bundled references:

- `.NET / C#`: `references/languages/dotnet.md`
- `JavaScript / TypeScript / Node.js / NestJS`: `references/languages/javascript-typescript.md`
- `Python`: `references/languages/python.md`

Java is intentionally not bundled.

If the user's language is not represented here, keep the AWS guidance language agnostic and consult current official AWS developer documentation rather than silently substituting another language.
