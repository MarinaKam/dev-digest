/* repo-context.tsx — tracks the active repo for the shell + :repoId routing.
   Priority: repoId in the URL path > localStorage (the last repo opened or
   picked, if it still exists) > first repo from the API. */
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useRepos } from "@/lib/hooks/repos";
import type { Repo } from "@devdigest/shared";

const RepoCtx = React.createContext<{
  repoId: string | null;
  setRepoId: (id: string) => void;
  repos: Repo[];
  activeRepo: Repo | null;
  reposLoaded: boolean;
  /** The repos are loaded and the stored choice was read: `activeRepo` is final. */
  ready: boolean;
}>({ repoId: null, setRepoId: () => {}, repos: [], activeRepo: null, reposLoaded: false, ready: false });

function repoIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/repos\/([^/]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

interface RepoProviderProps {
  children: React.ReactNode;
}

export function RepoProvider({ children }: RepoProviderProps) {
  const pathname = usePathname();
  const { data: repos, isSuccess: reposLoaded } = useRepos();
  const [stored, setStored] = React.useState<string | null>(null);
  // localStorage is read after mount (the server render has none); until then
  // the active repo may still change from the first repo to the stored one.
  const [storageRead, setStorageRead] = React.useState(false);

  React.useEffect(() => {
    try {
      setStored(localStorage.getItem("dd-repo"));
    } catch {
      /* ignore */
    }
    setStorageRead(true);
  }, []);

  const setRepoId = React.useCallback((id: string) => {
    setStored(id);
    try {
      localStorage.setItem("dd-repo", id);
    } catch {
      /* ignore */
    }
  }, []);

  const list = repos ?? [];
  const fromPath = repoIdFromPath(pathname);

  // The repo last opened by URL becomes the active one, so a page without a
  // repo in its URL (/conventions) shows the repo the user came from.
  React.useEffect(() => {
    if (fromPath && fromPath !== stored && list.some((r) => r.id === fromPath)) setRepoId(fromPath);
  }, [fromPath, stored, list, setRepoId]);

  // A stored repo that was removed no longer counts once the list is known.
  const storedValid = stored && (!reposLoaded || list.some((r) => r.id === stored)) ? stored : null;
  const repoId = fromPath ?? storedValid ?? list[0]?.id ?? null;
  const activeRepo = list.find((r) => r.id === repoId) ?? null;

  return (
    <RepoCtx.Provider
      value={{ repoId, setRepoId, repos: list, activeRepo, reposLoaded, ready: reposLoaded && storageRead }}
    >
      {children}
    </RepoCtx.Provider>
  );
}

export function useActiveRepo() {
  return React.useContext(RepoCtx);
}

/**
 * True once the repos list has loaded and the given :repoId matches none of
 * them — i.e. a stale/invalid repo in the URL ("no repo selected"). Repo-scoped
 * pages use this to show a friendly empty state instead of a "Repo not found"
 * error. Returns false while repos are still loading (avoids a flash) and on a
 * repos fetch failure (let the page surface its real error in that case).
 */
export function useRepoNotFound(repoId: string | null | undefined): boolean {
  const { repos, reposLoaded } = useActiveRepo();
  return reposLoaded && repoId != null && !repos.some((r) => r.id === repoId);
}
