import { spawnSync } from "node:child_process";
import {
	chmodSync,
	closeSync,
	existsSync,
	fchmodSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const confirmationPhrase = "REPLACE LOCAL DATABASE";
const postgresClientImage = "postgres:18-alpine";
const vercelProject = "edu";
const vercelScope = "trinhan";

export function parseEnvContent(content) {
	const values = new Map();
	for (const line of content.split(/\r?\n/)) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match) continue;

		let value = match[2] ?? "";
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		values.set(match[1], value);
	}
	return values;
}

export function parseNeonConnection(rawUrl) {
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error("DATABASE_URL_UNPOOLED không phải URL hợp lệ.");
	}
	if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
		throw new Error("DATABASE_URL_UNPOOLED không phải URL PostgreSQL.");
	}

	const connection = {
		host: url.hostname,
		port: url.port || "5432",
		database: decodeURIComponent(url.pathname.replace(/^\//, "")),
		username: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
	};

	if (!connection.host.endsWith(".neon.tech") || connection.host.includes("-pooler.")) {
		throw new Error("DATABASE_URL_UNPOOLED không phải endpoint Neon direct (non-pooled).");
	}
	if (!connection.database || !connection.username || !connection.password) {
		throw new Error("DATABASE_URL_UNPOOLED thiếu thông tin kết nối cần thiết.");
	}
	if (Object.values(connection).some((value) => /[\r\n]/.test(value))) {
		throw new Error("DATABASE_URL_UNPOOLED chứa ký tự không hợp lệ.");
	}
	return connection;
}

export function requireNeonDirectUrl(productionEnv) {
	const directUrl = productionEnv.get("DATABASE_URL_UNPOOLED");
	if (!directUrl) {
		throw new Error("Production env thiếu DATABASE_URL_UNPOOLED; dừng trước khi sửa database local.");
	}
	return parseNeonConnection(directUrl);
}

export function validateOverwriteConfirmation(answer) {
	if (answer !== confirmationPhrase) {
		throw new Error(`Xác nhận không khớp. Để thay dữ liệu local, nhập chính xác: ${confirmationPhrase}`);
	}
	return true;
}

export function validateInteractiveTerminal(inputIsTTY, outputIsTTY) {
	if (!inputIsTTY || !outputIsTTY) {
		throw new Error("Cần chạy trong terminal tương tác để xác nhận ghi đè database local.");
	}
	return true;
}

export function requireLocalContainer(containerId) {
	if (!containerId) {
		throw new Error("Không tìm thấy PostgreSQL local đang chạy. Khởi động bằng docker compose up -d trước.");
	}
	return containerId;
}

export function requireNonEmptyBackup(size, label) {
	if (size <= 0) throw new Error(`${label} rỗng; đã dừng.`);
	return true;
}

export async function restoreWithRecovery({ restoreNeon, recoverLocal, onRestoreFailure, backupDir, neonBackup, localBackup }) {
	try {
		await restoreNeon();
	} catch (restoreError) {
		onRestoreFailure?.();
		try {
			await recoverLocal();
		} catch (recoveryError) {
			throw new Error(`Khôi phục Neon và phục hồi local đều thất bại. Giữ nguyên hai backup để phục hồi thủ công: ${neonBackup}; ${localBackup}. Lỗi restore: ${restoreError instanceof Error ? restoreError.message : "không rõ"}. Lỗi phục hồi: ${recoveryError instanceof Error ? recoveryError.message : "không rõ"}`);
		}
		throw new Error(`Khôi phục Neon thất bại; dữ liệu local cũ đã được phục hồi. Backup được giữ tại ${backupDir}. Chi tiết: ${restoreError instanceof Error ? restoreError.message : "không rõ"}`);
	}
}

export function archiveListArgs() {
	return ["run", "--rm", "-i", postgresClientImage, "pg_restore", "--list"];
}

export function localRestoreArgs(localUser, localDatabase) {
	return [
		"compose", "exec", "-T", "postgres", "pg_restore",
		"-U", localUser, "-d", localDatabase,
		"--clean", "--if-exists", "--exit-on-error", "--single-transaction",
		"--no-owner", "--no-privileges",
	];
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: "inherit",
		...options,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${command} thất bại (mã ${result.status ?? "không xác định"}).`);
	}
	return result;
}

function capture(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
		...options,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${command} thất bại (mã ${result.status ?? "không xác định"}).`);
	}
	return result.stdout.trim();
}

function runWithFileOutput(command, args, outputPath) {
	const fd = openSync(outputPath, "w", 0o600);
	fchmodSync(fd, 0o600);
	let completed = false;
	try {
		run(command, args, { stdio: ["ignore", fd, "inherit"] });
		completed = true;
	} finally {
		closeSync(fd);
		if (!completed) rmSync(outputPath, { force: true });
	}
	chmodSync(outputPath, 0o600);
}

function runWithFileInput(command, args, inputPath) {
	const fd = openSync(inputPath, "r");
	try {
		run(command, args, { stdio: [fd, "inherit", "inherit"] });
	} finally {
		closeSync(fd);
	}
}

function runWithFileInputQuiet(command, args, inputPath) {
	const fd = openSync(inputPath, "r");
	try {
		run(command, args, { stdio: [fd, "ignore", "inherit"] });
	} finally {
		closeSync(fd);
	}
}

function escapePgPass(value) {
	return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("\n", "\\n");
}

function parseEnvFile(filePath) {
	return parseEnvContent(readFileSync(filePath, "utf8"));
}

async function requestOverwriteConfirmation() {
	validateInteractiveTerminal(process.stdin.isTTY, process.stdout.isTTY);
	const terminal = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await terminal.question(
			`Thao tác này sẽ thay toàn bộ dữ liệu trong PostgreSQL local. Nhập "${confirmationPhrase}" để tiếp tục: `,
		);
		validateOverwriteConfirmation(answer.trim());
	} finally {
		terminal.close();
	}
}

function ensureNonEmptyFile(filePath, label) {
	try {
		requireNonEmptyBackup(statSync(filePath).size, label);
	} catch (error) {
		rmSync(filePath, { force: true });
		throw error;
	}
}

function validateArchive(filePath) {
	try {
		runWithFileInputQuiet("docker", archiveListArgs(), filePath);
	} catch (error) {
		rmSync(filePath, { force: true });
		throw error;
	}
}

async function ensureVercelLogin() {
	const identity = spawnSync("npx", ["vercel", "whoami"], { cwd: rootDir, stdio: "inherit" });
	if (identity.error) throw identity.error;
	if (identity.status !== 0) {
		console.log("Đăng nhập Vercel trong terminal để truy cập environment Production.");
		run("npx", ["vercel", "login"]);
		run("npx", ["vercel", "whoami"]);
	}
}

function timestamp() {
	return new Date().toISOString().replaceAll(/[:.]/g, "-");
}

async function main() {
	await requestOverwriteConfirmation();

	const localEnvPath = path.join(rootDir, ".env");
	const localEnv = existsSync(localEnvPath) ? parseEnvFile(localEnvPath) : new Map();
	const localDatabase = process.env.DB_NAME || localEnv.get("DB_NAME") || "classroom_rental";
	const localUser = process.env.POSTGRES_USER || localEnv.get("POSTGRES_USER") || "postgres";
	if ([localDatabase, localUser].some((value) => /[\r\n]/.test(value))) {
		throw new Error("Cấu hình database local không hợp lệ.");
	}

	const backupDir = process.env.EDU_DB_BACKUP_DIR
		? path.resolve(process.env.EDU_DB_BACKUP_DIR)
		: path.join(os.homedir(), ".local", "share", "edu", "backups");
	mkdirSync(backupDir, { recursive: true, mode: 0o700 });
	chmodSync(backupDir, 0o700);
	const temporaryDir = mkdtempSync(path.join(os.tmpdir(), "edu-neon-backup-"));
	chmodSync(temporaryDir, 0o700);

	try {
		await ensureVercelLogin();
		requireLocalContainer(capture("docker", ["compose", "ps", "-q", "postgres"]));

		const productionEnvFile = path.join(temporaryDir, "production.env");
		console.log("Đang tải cấu hình Production tạm thời từ Vercel...");
		run("npx", [
			"vercel", "env", "pull", productionEnvFile,
			"--environment=production", "--yes",
			"--project", vercelProject, "--scope", vercelScope,
		]);
		chmodSync(productionEnvFile, 0o600);
		const productionEnv = parseEnvFile(productionEnvFile);
		const production = requireNeonDirectUrl(productionEnv);
		console.log(`Đã xác nhận Neon direct endpoint, database: ${production.database}`);

		const stamp = timestamp();
		const neonBackup = path.join(backupDir, `classroom-rental-neon-production-${stamp}.dump`);
		const localBackup = path.join(backupDir, `classroom-rental-local-before-neon-${stamp}.dump`);
		const passFile = path.join(temporaryDir, ".pgpass");
		const pgEnvFile = path.join(temporaryDir, "pg.env");
		writeFileSync(passFile, `${[
			escapePgPass(production.host),
			escapePgPass(production.port),
			escapePgPass(production.database),
			escapePgPass(production.username),
			escapePgPass(production.password),
		].join(":")}\n`, { mode: 0o600 });
		chmodSync(passFile, 0o600);
		writeFileSync(pgEnvFile, [
			`PGHOST=${production.host}`,
			`PGPORT=${production.port}`,
			`PGDATABASE=${production.database}`,
			`PGUSER=${production.username}`,
		].join("\n") + "\n", { mode: 0o600 });
		chmodSync(pgEnvFile, 0o600);

		console.log(`Đang tạo backup Neon Production: ${neonBackup}`);
		runWithFileOutput("docker", [
			"run", "--rm", "-i",
			"-v", `${passFile}:/run/secrets/edu-pgpass:ro`,
			"--env-file", pgEnvFile,
			"-e", "PGPASSFILE=/run/secrets/edu-pgpass",
			"-e", "PGSSLMODE=require",
			postgresClientImage,
			"pg_dump", "--no-password", "--format=custom", "--no-owner", "--no-privileges",
		], neonBackup);
		ensureNonEmptyFile(neonBackup, "Backup Neon Production");
		validateArchive(neonBackup);

		console.log(`Đang sao lưu database local hiện tại: ${localBackup}`);
		runWithFileOutput("docker", [
			"compose", "exec", "-T", "postgres", "pg_dump",
			"-U", localUser, "-d", localDatabase,
			"--format=custom", "--no-owner", "--no-privileges",
		], localBackup);
		ensureNonEmptyFile(localBackup, "Backup database local");
		validateArchive(localBackup);

		const restoreArgs = localRestoreArgs(localUser, localDatabase);
		console.log(`Đang khôi phục Neon vào database local ${localDatabase}...`);
		await restoreWithRecovery({
			restoreNeon: () => runWithFileInput("docker", restoreArgs, neonBackup),
			recoverLocal: () => runWithFileInput("docker", restoreArgs, localBackup),
			onRestoreFailure: () => console.error("Khôi phục Neon thất bại; đang thử phục hồi database local từ backup trước đó..."),
			backupDir,
			neonBackup,
			localBackup,
		});

		console.log(`Hoàn tất. Backup Neon và backup local trước khi thay thế được giữ tại: ${backupDir}`);
		console.log("Neon Production không bị thay đổi.");
	} finally {
		rmSync(temporaryDir, { recursive: true, force: true });
	}
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	main().catch((error) => {
		console.error(`\nThao tác dừng: ${error instanceof Error ? error.message : "lỗi không xác định"}`);
		process.exitCode = 1;
	});
}
