import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalDirectory = resolve(repositoryRoot, ".agents", "skills");
const claudeDirectory = resolve(repositoryRoot, ".claude", "skills");
const isClaudeSetup = process.argv.includes("--setup-claude");
const isValidateOnly = process.argv.includes("--validate");
const failures = [];

const collectFiles = async (root, current = root) => {
    const entries = await readdir(current, { withFileTypes: true });
    const nestedFiles = await Promise.all(entries
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (entry) => {
            const absolutePath = resolve(current, entry.name);
            return entry.isDirectory() ? collectFiles(root, absolutePath) : [relative(root, absolutePath).replaceAll("\\", "/")];
        }));

    return nestedFiles.flat();
};

const parseFrontmatter = (content, path) => {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
    if (!match) {
        failures.push(`${path}: missing leading YAML frontmatter`);
        return {};
    }

    const name = match[1].match(/^name:\s*(.+)\s*$/mu)?.[1]?.trim();
    const hasDescription = /^description:\s*(?:.+|[>|])\s*$/mu.test(match[1]);
    if (!name) {
        failures.push(`${path}: missing name`);
    }
    if (!hasDescription) {
        failures.push(`${path}: missing description`);
    }

    return { name };
};

const validateCanonicalSkills = async () => {
    const entries = await readdir(canonicalDirectory, { withFileTypes: true });
    const unexpectedEntries = entries.filter((entry) => !entry.isDirectory());
    unexpectedEntries.forEach((entry) => failures.push(`.agents/skills/${entry.name}: only skill directories are allowed`));

    const skillDirectories = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));
    for (const skillDirectory of skillDirectories) {
        const relativeSkillFile = `${skillDirectory.name}/SKILL.md`;
        const content = await readFile(resolve(canonicalDirectory, relativeSkillFile), "utf8").catch(() => undefined);
        if (content === undefined) {
            failures.push(`.agents/skills/${skillDirectory.name}: missing SKILL.md`);
            continue;
        }

        const frontmatter = parseFrontmatter(content, `.agents/skills/${relativeSkillFile}`);
        if (frontmatter.name !== skillDirectory.name) {
            failures.push(`.agents/skills/${relativeSkillFile}: frontmatter name must match directory`);
        }
    }
};

const assertClaudeDirectory = () => {
    const pathFromRoot = relative(repositoryRoot, claudeDirectory);
    if (pathFromRoot !== ".claude\\skills" && pathFromRoot !== ".claude/skills") {
        throw new Error(`Refusing to manage unexpected Claude directory: ${claudeDirectory}`);
    }
};

const setupClaude = async () => {
    assertClaudeDirectory();
    await rm(claudeDirectory, { recursive: true, force: true });
    await mkdir(claudeDirectory, { recursive: true });

    const portableFiles = (await collectFiles(canonicalDirectory))
        .filter((file) => !/^[^/]+\/agents\//u.test(file));

    for (const file of portableFiles) {
        const destination = resolve(claudeDirectory, file);
        await mkdir(dirname(destination), { recursive: true });
        await cp(resolve(canonicalDirectory, file), destination, { force: true, preserveTimestamps: true });
    }

    console.info(`Generated ${portableFiles.length} Claude-compatible repository skill files in .claude/skills.`);
};

const main = async () => {
    if (!isClaudeSetup && !isValidateOnly) {
        throw new Error("Use --setup-claude or --validate.");
    }

    await validateCanonicalSkills();
    if (failures.length) {
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exitCode = 1;
        return;
    }

    if (isValidateOnly) {
        console.info("Repository skills are valid.");
        return;
    }

    await setupClaude();
};

await main();
