// TODO: implemented by the media agent.
import { Router, type RequestHandler } from "express";
export const mediaRouter = Router();
export const browseHandler: RequestHandler = (_req, res) => void res.json({ dir: "", parent: null, entries: [] });
