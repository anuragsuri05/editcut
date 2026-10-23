// Project storage: each project is PROJECTS_DIR/<id>.json.
//   GET    /api/projects        -> ProjectSummary[] (most recently updated first)
//   GET    /api/projects/:id    -> Project
//   POST   /api/projects        -> create (body: Project, or {name}) -> Project
//   PUT    /api/projects/:id    -> save -> {ok, savedAt}
//   DELETE /api/projects/:id    -> {ok}
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../shared/types";
import { makeProject } from "../shared/factory";
import { PROJECTS_DIR } from "./config";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  path: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function projectFile(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error("Invalid project id");
  return path.join(PROJECTS_DIR, `${id}.json`);
}

export function readProject(id: string): Project | null {
  try {
    return JSON.parse(fs.readFileSync(projectFile(id), "utf8")) as Project;
  } catch {
    return null;
  }
}

/** Atomic write (temp file + rename) so a crash never leaves a half-written project. */
export function writeProject(p: Project): number {
  const file = projectFile(p.id);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(p));
  fs.renameSync(tmp, file);
  return Date.now();
}

export function listProjects(): ProjectSummary[] {
  const out: ProjectSummary[] = [];
  for (const f of fs.readdirSync(PROJECTS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const file = path.join(PROJECTS_DIR, f);
    try {
      // Only the header fields are needed; projects are small enough to parse whole.
      const p = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Project>;
      if (!p.id) continue;
      out.push({ id: p.id, name: p.name ?? "Untitled", updatedAt: p.updatedAt ?? fs.statSync(file).mtimeMs, path: file });
    } catch {
      /* skip corrupt files */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

function isProject(v: unknown): v is Project {
  const p = v as Project;
  return !!p && typeof p === "object" && typeof p.id === "string" && Array.isArray(p.items) && typeof p.media === "object" && typeof p.sequences === "object";
}

export const projectsRouter = Router();

projectsRouter.get("/", (_req, res) => {
  res.json(listProjects());
});

projectsRouter.get("/:id", (req, res) => {
  if (!SAFE_ID.test(req.params.id)) return void res.status(400).json({ error: "Invalid project id" });
  const p = readProject(req.params.id);
  if (!p) return void res.status(404).json({ error: "Project not found" });
  res.json(p);
});

projectsRouter.post("/", (req, res) => {
  const body = req.body;
  const p: Project = isProject(body) ? body : makeProject(typeof body?.name === "string" && body.name ? body.name : "Untitled Project");
  if (!SAFE_ID.test(p.id)) return void res.status(400).json({ error: "Invalid project id" });
  p.updatedAt = Date.now();
  writeProject(p);
  res.json(p);
});

projectsRouter.put("/:id", (req, res) => {
  const p = req.body;
  if (!SAFE_ID.test(req.params.id)) return void res.status(400).json({ error: "Invalid project id" });
  if (!isProject(p)) return void res.status(400).json({ error: "Body is not a project" });
  if (p.id !== req.params.id) return void res.status(400).json({ error: "Project id mismatch" });
  const savedAt = writeProject(p);
  res.json({ ok: true, savedAt });
});

projectsRouter.delete("/:id", (req, res) => {
  if (!SAFE_ID.test(req.params.id)) return void res.status(400).json({ error: "Invalid project id" });
  fs.rmSync(projectFile(req.params.id), { force: true });
  res.json({ ok: true });
});
