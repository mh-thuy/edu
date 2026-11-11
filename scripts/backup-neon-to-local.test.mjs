import test from "node:test";
import assert from "node:assert/strict";
import {
	parseEnvContent,
	parseNeonConnection,
	requireLocalContainer,
	requireNeonDirectUrl,
	requireNonEmptyBackup,
	restoreWithRecovery,
	validateInteractiveTerminal,
	validateOverwriteConfirmation,
} from "./backup-neon-to-local.mjs";

test("parses quoted env values without changing their contents", () => {
	const values = parseEnvContent("# comment\nDATABASE_URL_UNPOOLED=\"postgres://user:p%40ss@ep.example.neon.tech/db?sslmode=require\"\nexport DB_NAME='local copy'\n");

	assert.equal(values.get("DATABASE_URL_UNPOOLED"), "postgres://user:p%40ss@ep.example.neon.tech/db?sslmode=require");
	assert.equal(values.get("DB_NAME"), "local copy");
});

test("accepts Neon direct endpoint and decodes credentials", () => {
	assert.deepEqual(
		parseNeonConnection("postgres://user:p%40ss@ep-example.neon.tech:5433/classroom?sslmode=require"),
		{
			host: "ep-example.neon.tech",
			port: "5433",
			database: "classroom",
			username: "user",
			password: "p@ss",
		},
	);
});

test("rejects pooled and non-Neon database endpoints", () => {
	assert.throws(
		() => parseNeonConnection("postgres://user:pass@ep-example-pooler.neon.tech/db"),
		/endpoint Neon direct/,
	);
	assert.throws(
		() => parseNeonConnection("postgres://user:pass@localhost/db"),
		/endpoint Neon direct/,
	);
	assert.throws(
		() => parseNeonConnection("https://user:pass@ep-example.neon.tech/db"),
		/URL PostgreSQL/,
	);
});

test("requires the exact local overwrite confirmation", () => {
	assert.throws(() => validateOverwriteConfirmation(""), /Xác nhận không khớp/);
	assert.throws(() => validateOverwriteConfirmation("yes"), /Xác nhận không khớp/);
	assert.equal(validateOverwriteConfirmation("REPLACE LOCAL DATABASE"), true);
});

test("requires an interactive terminal before any backup or restore work", () => {
	assert.throws(() => validateInteractiveTerminal(false, false), /terminal tương tác/);
	assert.equal(validateInteractiveTerminal(true, true), true);
});

test("requires a direct Neon URL and a running local database", () => {
	assert.throws(() => requireNeonDirectUrl(new Map()), /thiếu DATABASE_URL_UNPOOLED/);
	assert.throws(() => requireLocalContainer(""), /Không tìm thấy PostgreSQL local/);
	assert.equal(requireLocalContainer("container-id"), "container-id");
});

test("rejects an empty backup before restore", () => {
	assert.throws(() => requireNonEmptyBackup(0, "Backup Neon"), /Backup Neon rỗng/);
	assert.equal(requireNonEmptyBackup(1, "Backup Neon"), true);
});

test("tries to restore the local backup when Neon restore fails", async () => {
	let recoveryAttempts = 0;
	await assert.rejects(
		restoreWithRecovery({
			restoreNeon: () => { throw new Error("Neon restore failed"); },
			recoverLocal: () => { recoveryAttempts += 1; },
			backupDir: "/backups",
			neonBackup: "/backups/neon.dump",
			localBackup: "/backups/local.dump",
		}),
		/đã được phục hồi/,
	);
	assert.equal(recoveryAttempts, 1);
});

test("keeps both backup paths in the error if local recovery also fails", async () => {
	await assert.rejects(
		restoreWithRecovery({
			restoreNeon: () => { throw new Error("Neon restore failed"); },
			recoverLocal: () => { throw new Error("Local recovery failed"); },
			backupDir: "/backups",
			neonBackup: "/backups/neon.dump",
			localBackup: "/backups/local.dump",
		}),
		(error) => error.message.includes("/backups/neon.dump")
			&& error.message.includes("/backups/local.dump")
			&& error.message.includes("Local recovery failed"),
	);
});
