"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
} from "@/components/ui/table";
import { clsx } from "clsx";
import {
  Search,
  RefreshCw,
  UserPlus,
  Building2,
  MapPin,
  Users,
  User,
  Crown,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  Shield,
  HelpCircle,
  Copy,
  Check,
  Expand,
  Shrink,
  AlertCircle,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type StatusType = "ACTIVE" | "INACTIVE" | "ON_LEAVE";
export type NodeType = "owner" | "team" | "manager" | "employee" | "unassigned";

export interface HierarchyNode {
  id: string;
  nodeType: NodeType;
  name: string;
  role?: string;
  designation?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  initials?: string;
  status?: StatusType;
  team?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  ownerName?: string | null;
  branchName?: string;
  branchId?: string;
  joiningDate?: string | null;
  memberCount?: number;
  children?: HierarchyNode[];
}

export interface BranchHierarchy {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  location: string;
  isHeadOffice: boolean;
  memberCount: number;
  teamCount: number;
  owner?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    avatarUrl?: string | null;
    initials: string;
    role: string;
    designation: string;
    status: StatusType;
    joiningDate?: string | null;
  } | null;
  tree: HierarchyNode[];
}

interface UserProfileRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  team: string | null;
  designation: string | null;
  status: string;
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function UsersSettingsPage() {
  const [branches, setBranches] = useState<BranchHierarchy[]>([]);
  const [rawUsers, setRawUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"hierarchy" | "flat">("hierarchy");

  // Interactive Tree States
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(),
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<HierarchyNode | null>(
    null,
  );
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Add Member Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isTeamSuggestionsOpen, setIsTeamSuggestionsOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [profileForm, setProfileForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    team: "",
    designation: "",
    status: "ACTIVE",
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    roleId: "",
    branchId: "",
    memberType: "OWNER" as "OWNER" | "MANAGER" | "EMPLOYEE",
    team: "",
    reportsToId: "",
    status: "ACTIVE",
  });

  const { toast } = useToast();

  /* ------------------------------ DATA FETCH ------------------------------ */

  const loadHierarchyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [hierarchyRes, usersRes, rolesRes] = await Promise.all([
        apiFetch<BranchHierarchy[]>("/users/hierarchy"),
        apiFetch("/users"),
        apiFetch("/roles"),
      ]);

      const branchList = Array.isArray(hierarchyRes) ? hierarchyRes : [];
      const availableRoles = Array.isArray(rolesRes) ? rolesRes : [];
      setBranches(branchList);
      setRawUsers(usersRes?.data || (Array.isArray(usersRes) ? usersRes : []));
      setRoles(availableRoles);

      if (branchList.length > 0 && !formData.branchId) {
        const defaultBranch = branchList[0];
        setFormData((prev) => ({
          ...prev,
          branchId: defaultBranch.id,
          memberType: defaultBranch.owner ? "EMPLOYEE" : "OWNER",
          reportsToId: defaultBranch.owner?.id || "",
        }));
      }
    } catch (err: any) {
      console.error("Failed to load team data:", err);
      setError(
        err.message ||
          "Unable to load branch hierarchy. Please check your network connection.",
      );
      toast({ type: "error", title: "Data Load Failed", message: err.message });
    } finally {
      setLoading(false);
    }
  }, [formData.branchId, toast]);

  useEffect(() => {
    loadHierarchyData();
  }, [loadHierarchyData]);

  /* ------------------------------- SEARCH UX ------------------------------ */

  // Find all node IDs matching query & their ancestor paths to auto-expand
  const { matchingNodeIds, branchesWithMatches, autoExpandNodeIds } =
    useMemo(() => {
      const term = search.trim().toLowerCase();
      if (!term) {
        return {
          matchingNodeIds: new Set<string>(),
          branchesWithMatches: new Set<string>(),
          autoExpandNodeIds: new Set<string>(),
        };
      }

      const matches = new Set<string>();
      const branchMatches = new Set<string>();
      const ancestors = new Set<string>();

      const checkNode = (
        node: HierarchyNode,
        branchId: string,
        parentIds: string[],
      ): boolean => {
        const nameMatch = node.name.toLowerCase().includes(term);
        const roleMatch = (node.role || "").toLowerCase().includes(term);
        const desigMatch = (node.designation || "")
          .toLowerCase()
          .includes(term);
        const emailMatch = (node.email || "").toLowerCase().includes(term);

        const isMatch = nameMatch || roleMatch || desigMatch || emailMatch;
        let childMatched = false;

        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            if (checkNode(child, branchId, [...parentIds, node.id])) {
              childMatched = true;
            }
          }
        }

        if (isMatch) {
          matches.add(node.id);
          branchMatches.add(branchId);
          parentIds.forEach((pid) => ancestors.add(pid));
        }

        if (childMatched) {
          ancestors.add(node.id);
          branchMatches.add(branchId);
        }

        return isMatch || childMatched;
      };

      branches.forEach((branch) => {
        // Check branch name/location itself
        if (
          branch.name.toLowerCase().includes(term) ||
          branch.location.toLowerCase().includes(term) ||
          branch.code.toLowerCase().includes(term)
        ) {
          branchMatches.add(branch.id);
        }

        branch.tree.forEach((rootNode) => {
          checkNode(rootNode, branch.id, []);
        });
      });

      return {
        matchingNodeIds: matches,
        branchesWithMatches: branchMatches,
        autoExpandNodeIds: ancestors,
      };
    }, [branches, search]);

  // When search changes and matches are found, auto-expand relevant branches & ancestor nodes
  useEffect(() => {
    if (search.trim()) {
      if (branchesWithMatches.size > 0) {
        setExpandedBranches((prev) => {
          const next = new Set(Array.from(prev));
          branchesWithMatches.forEach((id) => next.add(id));
          return next;
        });
      }
      if (autoExpandNodeIds.size > 0) {
        setExpandedNodes((prev) => {
          const next = new Set(Array.from(prev));
          autoExpandNodeIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [search, branchesWithMatches, autoExpandNodeIds]);

  /* --------------------------- EXPAND / COLLAPSE --------------------------- */

  const toggleBranch = (branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allBranchIds = branches.map((b) => b.id);
    const allNodeIds: string[] = [];

    const collectNodes = (node: HierarchyNode) => {
      if (node.children && node.children.length > 0) {
        allNodeIds.push(node.id);
        node.children.forEach(collectNodes);
      }
    };

    branches.forEach((b) => b.tree.forEach(collectNodes));

    setExpandedBranches(new Set(allBranchIds));
    setExpandedNodes(new Set(allNodeIds));
  };

  const handleCollapseAll = () => {
    setExpandedBranches(new Set());
    setExpandedNodes(new Set());
  };

  /* ---------------------------- ADD MEMBER MODAL --------------------------- */

  // Current selected branch for Add Member
  const selectedBranch = useMemo(() => {
    return (
      branches.find((b) => b.id === formData.branchId) || branches[0] || null
    );
  }, [branches, formData.branchId]);

  // Existing department/team names in the currently selected branch
  const existingBranchTeams = useMemo(() => {
    if (!selectedBranch) return [];
    const set = new Set<string>();
    const search = (node: HierarchyNode) => {
      if (node.nodeType === "team" && node.name) {
        set.add(node.name);
      }
      if (node.children) node.children.forEach(search);
    };
    selectedBranch.tree.forEach(search);
    return Array.from(set);
  }, [selectedBranch]);

  const matchingBranchTeams = useMemo(() => {
    const query = formData.team.trim().toLowerCase();
    if (!query) return [];
    return existingBranchTeams.filter((team) =>
      team.toLowerCase().includes(query),
    );
  }, [existingBranchTeams, formData.team]);

  // Respective managers for the exact department/team in selected branch
  const respectiveTeamManagers = useMemo(() => {
    if (!selectedBranch || !formData.team?.trim()) return [];
    const query = formData.team.trim().toLowerCase();
    const managersMap = new Map<
      string,
      { id: string; name: string; role?: string }
    >();

    // 1. Search inside selectedBranch hierarchy tree
    const searchTree = (node: HierarchyNode) => {
      const isTeamMatch =
        node.nodeType === "team" && node.name.trim().toLowerCase() === query;

      if (isTeamMatch) {
        const collect = (child: HierarchyNode) => {
          if (child.nodeType === "manager") {
            managersMap.set(child.id, {
              id: child.id,
              name: child.name,
              role: child.role,
            });
          }
          if (child.children) child.children.forEach(collect);
        };
        if (node.children) node.children.forEach(collect);
      }
      if (node.children) node.children.forEach(searchTree);
    };
    selectedBranch.tree.forEach(searchTree);

    // 2. Also search in rawUsers to be 100% complete
    rawUsers.forEach((u) => {
      const branchMatches =
        !formData.branchId ||
        u.branchAssignments?.some(
          (ba: any) => ba.branchId === formData.branchId,
        ) ||
        !u.branchAssignments ||
        u.branchAssignments?.length === 0;

      const userTeam = (u.team || "").trim().toLowerCase();
      const teamMatches = userTeam === query;

      const isMgr =
        u.memberType === "MANAGER" ||
        u.userRoles?.some((ur: any) => ur.role?.name.includes("MANAGER")) ||
        (u.designation && u.designation.toLowerCase().includes("manager")) ||
        rawUsers.some((sub) => sub.reportsToId === u.id);

      if (branchMatches && teamMatches && isMgr) {
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        if (!managersMap.has(u.id)) {
          managersMap.set(u.id, {
            id: u.id,
            name: fullName,
            role: u.userRoles?.[0]?.role?.name || "Manager",
          });
        }
      }
    });

    return Array.from(managersMap.values());
  }, [selectedBranch, formData.team, formData.branchId, rawUsers]);

  // Handle dynamic defaulting of reportsToId according to team presence and respective managers
  useEffect(() => {
    if (!selectedBranch) return;
    const ownerId = selectedBranch.owner?.id || "";

    // If no team specified: default directly to branch owner
    if (!formData.team?.trim()) {
      setFormData((prev) =>
        prev.reportsToId !== ownerId ? { ...prev, reportsToId: ownerId } : prev,
      );
      return;
    }

    // If team is specified:
    if (respectiveTeamManagers.length === 1) {
      // 1 manager in this team: default directly to that respective manager
      const mgrId = respectiveTeamManagers[0].id;
      setFormData((prev) =>
        prev.reportsToId !== mgrId ? { ...prev, reportsToId: mgrId } : prev,
      );
    } else if (respectiveTeamManagers.length >= 2) {
      // 2 or more managers: default to the first one if current selection is invalid
      setFormData((prev) => {
        if (!respectiveTeamManagers.some((m) => m.id === prev.reportsToId)) {
          return { ...prev, reportsToId: respectiveTeamManagers[0].id };
        }
        return prev;
      });
    } else {
      // New team / no managers in this team yet: default to owner
      setFormData((prev) =>
        prev.reportsToId !== ownerId ? { ...prev, reportsToId: ownerId } : prev,
      );
    }
  }, [formData.team, selectedBranch, respectiveTeamManagers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const isOwner = formData.memberType === "OWNER";

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !formData.password ||
      (!isOwner &&
        (!formData.roleId ||
          !roles.some((role) => role.id === formData.roleId)))
    ) {
      toast({
        type: "warning",
        title: "Missing required fields",
        message: isOwner
          ? "First name, last name, email, phone number, and password are required."
          : "First name, last name, email, phone number, password, and role are required.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        type: "warning",
        title: "Invalid email",
        message: "Enter a valid email address.",
      });
      return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      toast({
        type: "warning",
        title: "Invalid phone number",
        message: "Enter a 10-digit phone number.",
      });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password: formData.password,
          phone: phone || undefined,
          roleIds: isOwner ? [] : [formData.roleId],
          branchIds: formData.branchId ? [formData.branchId] : [],
          memberType: formData.memberType,
          team:
            formData.memberType === "OWNER"
              ? undefined
              : formData.team.trim() || undefined,
          reportsToId:
            formData.memberType === "OWNER"
              ? undefined
              : formData.reportsToId || undefined,
          status: formData.status,
        }),
      });

      toast({
        type: "success",
        title:
          formData.memberType === "OWNER"
            ? "Branch owner created"
            : "Team member onboarded",
        message: `${firstName} ${lastName} has been added successfully.`,
      });
      setIsModalOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        roleId: "",
        branchId: formData.branchId,
        memberType: "EMPLOYEE",
        team: "",
        reportsToId: "",
        status: "ACTIVE",
      });
      await loadHierarchyData();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Onboarding failed",
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProfile = async () => {
    if (!selectedMember || selectedMember.nodeType === "team") return;

    try {
      const user = await apiFetch<UserProfileRecord>(
        `/users/${selectedMember.id}`,
      );
      setEditingProfileId(user.id);
      setProfileForm({
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        team: user.team || "",
        designation: user.designation || "",
        status: user.status || "ACTIVE",
      });
      setSelectedMember(null);
      setIsProfileEditOpen(true);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Unable to edit profile",
        message: err.message,
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    const phone = profileForm.phone.trim();

    if (!firstName || !lastName) {
      toast({
        type: "warning",
        title: "Missing required fields",
        message: "First name and last name are required.",
      });
      return;
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      toast({
        type: "warning",
        title: "Invalid phone number",
        message: "Enter a 10-digit phone number.",
      });
      return;
    }

    try {
      setSavingProfile(true);
      await apiFetch(`/users/${editingProfileId}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          team: profileForm.team.trim(),
          designation: profileForm.designation.trim(),
          status: profileForm.status,
        }),
      });
      toast({
        type: "success",
        title: "Profile updated",
        message: `${firstName} ${lastName}'s profile was updated.`,
      });
      setIsProfileEditOpen(false);
      setEditingProfileId("");
      await loadHierarchyData();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Profile update failed",
        message: err.message,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedMember || selectedMember.nodeType === "team") return;
    const { id, name } = selectedMember;
    if (
      !window.confirm(
        `Delete ${name}'s profile? Their account will be deactivated and removed from the active hierarchy.`,
      )
    ) {
      return;
    }

    try {
      setDeletingProfile(true);
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      toast({
        type: "success",
        title: "Profile deleted",
        message: `${name}'s account was deactivated.`,
      });
      setSelectedMember(null);
      await loadHierarchyData();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Profile deletion failed",
        message: err.message,
      });
    } finally {
      setDeletingProfile(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    toast({
      type: "success",
      title: "Copied",
      message: "Email copied to clipboard",
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.015em] text-text-primary">
              Team Members & Hierarchy
            </h1>
            <Badge size="sm" variant="accent" className="font-mono text-[11px]">
              {branches.reduce((acc, b) => acc + b.memberCount, 0)} Total Staff
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Visual organizational structure across branches. Indented connector
            lines illustrate reporting hierarchy and department teams.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-secondary/80 p-0.5 rounded-lg border border-border/80">
            <button
              onClick={() => setViewMode("hierarchy")}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                viewMode === "hierarchy"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-primary",
              )}
              title="Hierarchy Tree View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Hierarchy Tree</span>
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                viewMode === "flat"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-primary",
              )}
              title="Classic Flat Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Flat Table</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={loadHierarchyData}
            icon={
              <RefreshCw
                className={clsx("w-3.5 h-3.5", loading && "animate-spin")}
              />
            }
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            icon={<UserPlus className="w-3.5 h-3.5" />}
          >
            Add Team Member
          </Button>
        </div>
      </div>

      {/* Control Bar: Search & Global Expand/Collapse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Input
            placeholder="Search by name, role, team or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefixIcon={<Search className="w-3.5 h-3.5 text-text-tertiary" />}
          />
          {search && (
            <span className="absolute right-3 top-2.5 text-[11px] font-mono text-text-tertiary">
              {matchingNodeIds.size} match
              {matchingNodeIds.size === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {viewMode === "hierarchy" && (
          <div className="flex items-center gap-2 text-xs">
            {/* <span className="text-text-tertiary hidden sm:inline">
              Tree controls:
            </span> */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExpandAll}
              icon={<Expand className="w-3.5 h-3.5" />}
              className="h-8 whitespace-nowrap px-2.5 text-xs text-text-secondary"
            >
              Expand All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCollapseAll}
              icon={<Shrink className="w-3.5 h-3.5" />}
              className="h-8 whitespace-nowrap px-2.5 text-xs text-text-secondary"
            >
              Collapse All
            </Button>
          </div>
        )}
      </div>

      {/* Hierarchy Legend */}
      {/* {viewMode === "hierarchy" && !loading && branches.length > 0 && (
        <div className="flex items-center flex-wrap gap-4 px-3.5 py-2 text-[11px] bg-surface-secondary/40 border border-border/60 rounded-lg text-text-secondary">
          <span className="font-semibold text-text-primary uppercase tracking-wider text-[10px]">
            Hierarchy Order:
          </span>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Branch</span>
          </div>
          <span className="text-text-tertiary">→</span>
          <div className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-purple-500" />
            <span>Branch Owner</span>
          </div>
          <span className="text-text-tertiary">→</span>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-500" />
            <span>Team / Dept</span>
          </div>
          <span className="text-text-tertiary">→</span>
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
            <span>Manager</span>
          </div>
          <span className="text-text-tertiary">→</span>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-text-tertiary" />
            <span>Employee</span>
          </div>
        </div>
      )} */}

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold text-red-600 dark:text-red-400">
              Failed to load team data
            </h4>
            <p className="text-xs text-text-secondary mt-0.5">{error}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={loadHierarchyData}
              className="mt-2.5"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && branches.length === 0 && (
        <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl bg-surface/50">
          <Building2 className="w-10 h-10 text-text-tertiary mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-text-primary">
            No branches or teams configured
          </h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            Get started by adding branch profiles or onboarding staff members
            into your organization.
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            className="mt-3"
          >
            Add First Team Member
          </Button>
        </div>
      )}

      {/* HIERARCHY TREE VIEW */}
      {!loading &&
        !error &&
        viewMode === "hierarchy" &&
        branches.length > 0 && (
          <div
            className="space-y-3.5"
            role="tree"
            aria-label="Branch Organization Hierarchy"
          >
            {branches.map((branch) => {
              const isBranchOpen = expandedBranches.has(branch.id);
              const hasMatchingStaff = branchesWithMatches.has(branch.id);

              return (
                <div
                  key={branch.id}
                  className={clsx(
                    "rounded-xl border transition-all duration-200 bg-surface shadow-xs overflow-hidden",
                    isBranchOpen
                      ? "border-border/90 ring-1 ring-black/5 dark:ring-white/5"
                      : "border-border/70 hover:border-border hover:shadow-sm",
                    hasMatchingStaff &&
                      search.trim() &&
                      "ring-1 ring-accent/60",
                  )}
                  role="treeitem"
                  aria-expanded={isBranchOpen}
                >
                  {/* LEVEL 1: Branch Row / Card */}
                  <button
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-surface-secondary/40 active:bg-surface-secondary/70 transition-colors cursor-pointer group"
                    aria-label={`Branch ${branch.name}, ${isBranchOpen ? "expanded" : "collapsed"}`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Expand/Collapse Chevron */}
                      <div
                        className={clsx(
                          "w-7 h-7 rounded-lg flex items-center justify-center bg-surface-secondary text-text-secondary transition-transform duration-200 group-hover:text-text-primary group-hover:bg-border/60",
                          isBranchOpen && "rotate-90 bg-accent/10 text-accent",
                        )}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </div>

                      {/* Branch Icon & Names */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary tracking-[-0.01em] group-hover:text-accent transition-colors">
                            {branch.name}
                          </span>
                          {branch.isHeadOffice && (
                            <Badge
                              size="sm"
                              variant="accent"
                              className="text-[10px] uppercase font-semibold tracking-wide"
                            >
                              Head Office
                            </Badge>
                          )}
                          <span className="font-mono text-xs text-text-tertiary">
                            ({branch.code})
                          </span>
                        </div>

                        {/* Location & Details */}
                        <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                            <MapPin className="w-3 h-3 text-text-tertiary shrink-0" />
                            {branch.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Branch Metrics & Owner preview */}
                    <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                      {/* Branch Owner Cardlet */}
                      {branch.owner && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember({
                              ...branch.owner!,
                              nodeType: "owner",
                              branchName: branch.name,
                              branchId: branch.id,
                            });
                          }}
                          className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-secondary/70 hover:bg-purple-500/10 border border-border/60 hover:border-purple-500/30 transition-all text-xs"
                          title="Click to view owner profile"
                        >
                          <div className="w-6 h-6 rounded-full bg-purple-600/15 text-purple-700 dark:text-purple-300 font-semibold flex items-center justify-center text-[10px] shrink-0 border border-purple-500/30">
                            {branch.owner.initials}
                          </div>
                          <div className="text-left">
                            <div className="text-[10px] text-purple-700 dark:text-purple-300 font-medium leading-none flex items-center gap-1">
                              <Crown className="w-2.5 h-2.5" />
                              Owner
                            </div>
                            <span className="text-[12px] font-medium text-text-primary leading-tight block">
                              {branch.owner.name}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Member & Team Count Badges */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-secondary text-xs text-text-secondary font-medium">
                          <Users className="w-3.5 h-3.5 text-text-tertiary" />
                          <span>
                            {branch.memberCount}{" "}
                            {branch.memberCount === 1 ? "member" : "members"}
                          </span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-secondary text-xs text-text-secondary font-medium">
                          <Building2 className="w-3.5 h-3.5 text-text-tertiary" />
                          <span>
                            {branch.teamCount}{" "}
                            {branch.teamCount === 1 ? "team" : "teams"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* LEVEL 2: Expanded Branch Hierarchy Tree */}
                  {isBranchOpen && (
                    <div className="px-5 pb-5 pt-2 border-t border-border/70 bg-surface-secondary/20">
                      <div className="overflow-x-auto py-2">
                        <div className="min-w-[620px]">
                          {branch.tree.length === 0 ? (
                            <div className="py-6 text-center text-xs text-text-tertiary">
                              No team members or owner assigned to this branch
                              yet.
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {branch.tree.map((rootNode, idx) => (
                                <HierarchyTreeNode
                                  key={rootNode.id}
                                  node={rootNode}
                                  isLast={idx === branch.tree.length - 1}
                                  expandedNodes={expandedNodes}
                                  toggleNode={toggleNode}
                                  onSelectMember={setSelectedMember}
                                  matchingNodeIds={matchingNodeIds}
                                  search={search}
                                  level={1}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* FLAT TABLE VIEW (ALTERNATIVE FOR POWER USERS) */}
      {!loading && !error && viewMode === "flat" && (
        <div className="border border-border/80 rounded-xl overflow-hidden bg-surface shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Team / Department</TableHead>
                <TableHead>Role / Designation</TableHead>
                <TableHead>Reports To</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rawUsers.length === 0 ? (
                <TableEmptyState message="No team members match the search query." />
              ) : (
                rawUsers
                  .filter((u) => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (
                      `${u.firstName} ${u.lastName}`
                        .toLowerCase()
                        .includes(q) ||
                      u.email.toLowerCase().includes(q) ||
                      (u.team || "").toLowerCase().includes(q) ||
                      (u.designation || "").toLowerCase().includes(q)
                    );
                  })
                  .map((u) => (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-surface-secondary/50"
                      onClick={() =>
                        setSelectedMember({
                          id: u.id,
                          nodeType: u.reportsToId ? "employee" : "manager",
                          name: `${u.firstName} ${u.lastName}`.trim(),
                          role: u.userRoles?.[0]?.role?.name || "Member",
                          designation: u.designation,
                          email: u.email,
                          phone: u.phone,
                          status:
                            (u.status as StatusType) ||
                            (u.isActive ? "ACTIVE" : "INACTIVE"),
                          team: u.team,
                          branchName: u.branchAssignments?.[0]?.branch?.name,
                          branchId: u.branchAssignments?.[0]?.branch?.id,
                          joiningDate: u.joiningDate,
                        })
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface-secondary flex items-center justify-center text-xs font-semibold text-text-primary">
                            {(u.firstName?.[0] || "U").toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-text-primary block">
                              {u.firstName} {u.lastName}
                            </span>
                            <span className="font-mono text-[11px] text-text-secondary">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {u.branchAssignments?.[0]?.branch?.name ||
                          "All Branches"}
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" variant="neutral">
                          {u.team || "Unassigned"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-text-primary">
                          {u.designation || "Staff"}
                        </span>
                        <span className="text-[11px] text-text-tertiary block">
                          {u.userRoles?.[0]?.role?.name || ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {u.reportsTo
                          ? `${u.reportsTo.firstName} ${u.reportsTo.lastName}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusDot
                          status={
                            (u.status as StatusType) ||
                            (u.isActive ? "ACTIVE" : "INACTIVE")
                          }
                          showLabel
                        />
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* MEMBER DETAILS DRAWER */}
      <Drawer
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title="Team Member Profile"
        description="Comprehensive personnel record, reporting lines, and branch credentials."
        width="md"
      >
        {selectedMember && (
          <div className="space-y-6">
            {/* Header / Avatar Profile */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-secondary/50 border border-border/80">
              <div
                className={clsx(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 border shadow-xs",
                  selectedMember.nodeType === "owner"
                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                    : selectedMember.nodeType === "manager"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-accent/10 text-accent border-accent/20",
                )}
              >
                {selectedMember.initials ||
                  selectedMember.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-text-primary tracking-[-0.01em]">
                    {selectedMember.name}
                  </h3>
                  <StatusDot
                    status={selectedMember.status || "ACTIVE"}
                    showLabel
                  />
                </div>

                <p className="text-xs font-medium text-text-secondary mt-0.5">
                  {selectedMember.designation ||
                    selectedMember.role ||
                    "Staff Member"}
                </p>

                <div className="mt-2 flex items-center gap-1.5">
                  <NodeBadge nodeType={selectedMember.nodeType} />
                  {selectedMember.team && (
                    <Badge size="sm" variant="neutral">
                      {selectedMember.team} Team
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Contact Details
              </span>
              <div className="grid grid-cols-1 gap-2">
                {selectedMember.email && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-surface">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail className="w-4 h-4 text-text-tertiary shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-semibold text-text-tertiary block leading-none">
                          Email Address
                        </span>
                        <span className="font-mono text-xs text-text-primary truncate block mt-0.5">
                          {selectedMember.email}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedMember.email!)}
                      className="h-7 w-7 p-0"
                      title="Copy email"
                    >
                      {copiedEmail ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-surface">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Phone className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-text-tertiary block leading-none">
                        Phone Number
                      </span>
                      <span className="font-mono text-xs text-text-primary block mt-0.5">
                        {selectedMember.phone || "Not registered"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reporting & Hierarchy Context */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Reporting & Organization
              </span>
              <div className="space-y-2 p-3 rounded-xl border border-border/70 bg-surface text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-text-tertiary" />
                    Assigned Branch
                  </span>
                  <span className="font-medium text-text-primary">
                    {selectedMember.branchName || "Not Assigned"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-text-tertiary" />
                    Department / Team
                  </span>
                  <span className="font-medium text-text-primary">
                    {selectedMember.team || "Unassigned"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-text-tertiary" />
                    Reporting manager
                  </span>
                  <span className="font-medium text-text-primary">
                    {selectedMember.nodeType === "owner"
                      ? "Board / Platform Owner"
                      : selectedMember.managerName ||
                        selectedMember.ownerName ||
                        "Branch Owner"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
                    Joining Date
                  </span>
                  <span className="font-mono text-text-primary">
                    {selectedMember.joiningDate
                      ? new Date(selectedMember.joiningDate).toLocaleDateString(
                          "en-IN",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "Not recorded"}
                  </span>
                </div>
              </div>
            </div>

            {/* Subordinates count if manager */}
            {selectedMember.children && selectedMember.children.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Direct Reports ({selectedMember.children.length})
                </span>
                <div className="space-y-1.5">
                  {selectedMember.children.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedMember(sub)}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border/60 hover:bg-surface-secondary/70 cursor-pointer transition-all text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-secondary flex items-center justify-center text-[10px] font-bold">
                          {sub.initials}
                        </div>
                        <div>
                          <span className="font-medium text-text-primary block leading-tight">
                            {sub.name}
                          </span>
                          <span className="text-[11px] text-text-secondary">
                            {sub.designation || sub.role}
                          </span>
                        </div>
                      </div>
                      <StatusDot status={sub.status || "ACTIVE"} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedMember.nodeType !== "team" && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={handleEditProfile}
                  disabled={deletingProfile}
                  className="flex-1"
                >
                  Edit Profile
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={handleDeleteProfile}
                  loading={deletingProfile}
                  className="flex-1"
                >
                  Delete Profile
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* EDIT TEAM MEMBER PROFILE MODAL */}
      <Modal
        isOpen={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
        title="Edit Team Member Profile"
        description="Update this team member's profile details."
      >
        <form onSubmit={handleSaveProfile} className="space-y-3.5">
          <Input
            label="Email Address"
            type="email"
            value={profileForm.email}
            disabled
          />
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="First Name *"
              value={profileForm.firstName}
              onChange={(e) =>
                setProfileForm({ ...profileForm, firstName: e.target.value })
              }
              required
            />
            <Input
              label="Last Name *"
              value={profileForm.lastName}
              onChange={(e) =>
                setProfileForm({ ...profileForm, lastName: e.target.value })
              }
              required
            />
          </div>
          <Input
            label="Phone Number"
            type="tel"
            value={profileForm.phone}
            onChange={(e) =>
              setProfileForm({
                ...profileForm,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              })
            }
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Enter a 10-digit phone number"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Team"
              value={profileForm.team}
              onChange={(e) =>
                setProfileForm({ ...profileForm, team: e.target.value })
              }
            />
            <Input
              label="Designation"
              value={profileForm.designation}
              onChange={(e) =>
                setProfileForm({
                  ...profileForm,
                  designation: e.target.value,
                })
              }
            />
          </div>
          <Select
            label="Status"
            value={profileForm.status}
            onChange={(e) =>
              setProfileForm({ ...profileForm, status: e.target.value })
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ON_LEAVE">On Leave</option>
          </Select>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsProfileEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingProfile}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD TEAM MEMBER MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Onboard New Team Member"
        description="Add staff credentials and place them directly in the branch hierarchy tree."
      >
        <form onSubmit={handleCreateUser} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="First Name *"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              placeholder="e.g. Ramesh"
              required
            />
            <Input
              label="Last Name *"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              placeholder="e.g. Kumar"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Email Address *"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="name@company.com"
              prefixIcon={<Mail className="w-3.5 h-3.5" />}
              autoComplete="email"
              required
            />
            <Input
              label="Phone Number *"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
              placeholder="10-digit number"
              prefixIcon={<Phone className="w-3.5 h-3.5" />}
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              title="Enter a 10-digit phone number"
              autoComplete="tel-national"
              required
            />
          </div>

          <Input
            label="Initial Password *"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder="Minimum 8 characters"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Select
              label="Assigned Branch *"
              value={formData.branchId}
              required
              onChange={(e) => {
                const branch = branches.find(
                  (item) => item.id === e.target.value,
                );
                setFormData((prev) => ({
                  ...prev,
                  branchId: e.target.value,
                  reportsToId: branch?.owner?.id || "",
                  memberType: branch?.owner
                    ? prev.memberType === "OWNER"
                      ? "EMPLOYEE"
                      : prev.memberType
                    : "OWNER",
                  team: branch?.owner ? prev.team : "",
                }));
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </Select>

            {formData.memberType === "OWNER" ? (
              <div className="flex min-h-8 items-center rounded-md border border-border bg-surface-secondary/70 px-3 text-xs text-text-secondary">
                Business Owner role is assigned automatically.
              </div>
            ) : (
              <Select
                label="System Role *"
                value={formData.roleId}
                required
                onChange={(e) =>
                  setFormData({ ...formData, roleId: e.target.value })
                }
              >
                <option value="" disabled>
                  {roles.length ? "Select a role" : "Create a role first"}
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-3">
            <div className="w-full flex flex-col gap-1 text-left">
              <label
                id="position-type-label"
                className="text-xs font-medium text-text-secondary select-none tracking-tight"
              >
                Position Type <span className="text-danger">*</span>
              </label>
              <fieldset
                aria-labelledby="position-type-label"
                className="grid w-full grid-cols-3 items-center gap-1 bg-surface-secondary/80 p-0.5 rounded-lg border border-border/80"
              >
                {(["OWNER", "MANAGER", "EMPLOYEE"] as const).map(
                  (memberType) => {
                    const isDisabled = selectedBranch?.owner
                      ? memberType === "OWNER"
                      : memberType !== "OWNER";
                    return (
                      <label
                        key={memberType}
                        className={clsx(
                          "min-w-0",
                          isDisabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer",
                        )}
                      >
                        <input
                          type="radio"
                          name="memberType"
                          value={memberType}
                          checked={formData.memberType === memberType}
                          disabled={isDisabled}
                          onChange={() =>
                            setFormData((prev) => ({
                              ...prev,
                              memberType,
                              ...(memberType === "OWNER"
                                ? { team: "", reportsToId: "" }
                                : {}),
                            }))
                          }
                          className="peer sr-only"
                        />
                        <span
                          className={clsx(
                            "flex w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-center text-xs font-medium rounded-md transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
                            formData.memberType === memberType
                              ? "bg-accent text-white shadow-sm"
                              : "text-text-secondary hover:bg-surface/70 hover:text-text-primary",
                          )}
                        >
                          {memberType === "OWNER"
                            ? "Owner"
                            : memberType === "EMPLOYEE"
                              ? "Employee"
                              : "Manager"}
                          {formData.memberType === memberType && (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </span>
                      </label>
                    );
                  },
                )}
              </fieldset>
              {!selectedBranch?.owner && (
                <p className="text-[11px] text-text-tertiary">
                  Create the branch owner first to enable Manager and Employee.
                </p>
              )}
            </div>

            <Select
              label="Initial Status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
            </Select>
          </div>

          {formData.memberType !== "OWNER" && (
            <>
              <div
                onBlur={(e) => {
                  if (
                    !e.currentTarget.contains(e.relatedTarget as Node | null)
                  ) {
                    setIsTeamSuggestionsOpen(false);
                  }
                }}
              >
                <Input
                  label="Department / Team (Optional)"
                  value={formData.team}
                  onChange={(e) =>
                    setFormData({ ...formData, team: e.target.value })
                  }
                  onFocus={() => setIsTeamSuggestionsOpen(true)}
                  placeholder="e.g. Operations, Sales"
                />
                {isTeamSuggestionsOpen && matchingBranchTeams.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Matching teams"
                    className="mt-1 max-h-[84px] overflow-y-auto overscroll-contain rounded-md border border-border bg-surface shadow-sm"
                  >
                    {matchingBranchTeams.map((team) => (
                      <button
                        key={team}
                        type="button"
                        role="option"
                        aria-selected={
                          formData.team.trim().toLowerCase() ===
                          team.toLowerCase()
                        }
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, team }));
                          setIsTeamSuggestionsOpen(false);
                        }}
                        className="block w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                      >
                        {team}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Reports To: Driven by Team & Respective Managers */}
              {!formData.team?.trim() ? (
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">
                    Reporting manager
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-surface-secondary/70 border border-border text-xs text-text-secondary flex items-center justify-between">
                    <span>
                      Branch Owner:{" "}
                      <strong className="text-text-primary">
                        {selectedBranch?.owner?.name || "Owner"}
                      </strong>
                    </span>
                    <Badge size="sm" variant="accent">
                      Default (No Team)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">
                    Without a team name, members report directly to the Branch
                    Owner.
                  </p>
                </div>
              ) : respectiveTeamManagers.length >= 2 ? (
                <Select
                  label="Reporting manager"
                  value={formData.reportsToId}
                  onChange={(e) =>
                    setFormData({ ...formData, reportsToId: e.target.value })
                  }
                >
                  {respectiveTeamManagers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.name} (Manager)
                    </option>
                  ))}
                </Select>
              ) : respectiveTeamManagers.length === 1 ? (
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">
                    Reporting manager
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                    <span>
                      Manager:{" "}
                      <strong className="text-text-primary">
                        {respectiveTeamManagers[0].name}
                      </strong>
                    </span>
                    <Badge size="sm" variant="success">
                      Assigned Manager
                    </Badge>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">
                    Reporting manager
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-surface-secondary/70 border border-border text-xs text-text-secondary flex items-center justify-between">
                    <span>
                      Branch Owner:{" "}
                      <strong className="text-text-primary">
                        {selectedBranch?.owner?.name || "Owner"}
                      </strong>
                    </span>
                    <Badge size="sm" variant="neutral">
                      Initial Lead
                    </Badge>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">
                    No manager designated for this team yet. Reports directly to
                    Branch Owner.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {formData.memberType === "OWNER"
                ? "Create Branch Owner"
                : "Onboard Member"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         HIERARCHY TREE NODE (LEVEL 2)                      */
/* -------------------------------------------------------------------------- */

interface HierarchyTreeNodeProps {
  node: HierarchyNode;
  isLast: boolean;
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
  onSelectMember: (node: HierarchyNode) => void;
  matchingNodeIds: Set<string>;
  search: string;
  level: number;
}

function HierarchyTreeNode({
  node,
  isLast,
  expandedNodes,
  toggleNode,
  onSelectMember,
  matchingNodeIds,
  search,
  level,
}: HierarchyTreeNodeProps) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isOpen = expandedNodes.has(node.id);
  const isMatched = matchingNodeIds.has(node.id) && Boolean(search.trim());

  // Distinct visual markers per node level
  const isOwner = node.nodeType === "owner";
  const isTeam = node.nodeType === "team" || node.nodeType === "unassigned";
  const isManager = node.nodeType === "manager";
  const isEmployee = node.nodeType === "employee";

  return (
    <div
      className="relative flex flex-col group/item"
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
    >
      {/* 
        Connector Lines (file-tree / org-chart outline):
        - Vertical line down from top: stops at node elbow if isLast, otherwise runs full height
        - Horizontal elbow connecting directly to the node card
      */}
      <div
        className={clsx(
          "absolute -left-5 w-px bg-border/80 dark:bg-border/60 transition-colors",
          isLast ? "top-0 h-4" : "top-0 bottom-0",
        )}
      />
      <div className="absolute -left-5 top-4 w-4 h-px bg-border/80 dark:bg-border/60" />

      {/* Node Row Card */}
      <div className="py-1">
        <div
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            } else if (!isTeam) {
              onSelectMember(node);
            }
          }}
          className={clsx(
            "inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs transition-all duration-150 cursor-pointer select-none",
            // Default styling based on type
            isOwner &&
              "bg-purple-500/10 text-purple-900 dark:text-purple-200 border-purple-500/30 hover:bg-purple-500/15 shadow-xs",
            isTeam &&
              "bg-sky-500/10 text-sky-900 dark:text-sky-200 border-sky-500/25 hover:bg-sky-500/15 font-medium",
            isManager &&
              "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/15",
            isEmployee &&
              "bg-surface text-text-primary border-border/80 hover:bg-surface-secondary/70 hover:border-border",
            node.nodeType === "unassigned" &&
              "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30 hover:bg-amber-500/15",
            // Search Match Highlight
            isMatched && "ring-2 ring-accent ring-offset-1 bg-accent/15",
          )}
        >
          {/* Expand/Collapse Toggle for nodes with children */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="w-4 h-4 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={isOpen ? "Collapse" : "Expand"}
              title={isOpen ? "Click to collapse" : "Click to expand"}
            >
              <ChevronRight
                className={clsx(
                  "w-3.5 h-3.5 transition-transform duration-200",
                  isOpen && "rotate-90",
                )}
              />
            </button>
          ) : (
            <span className="w-1.5" />
          )}

          {/* Level Icon / Avatar */}
          {isOwner ? (
            <div className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-[10px] shrink-0 border border-purple-500/40">
              <Crown className="w-3.5 h-3.5" />
            </div>
          ) : isTeam ? (
            <div className="w-6 h-6 rounded-lg bg-sky-600/20 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
          ) : isManager ? (
            <div className="w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 border border-emerald-500/40">
              {node.initials || <Briefcase className="w-3 h-3" />}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-surface-secondary text-text-secondary flex items-center justify-center font-bold text-[10px] shrink-0 border border-border">
              {node.initials || <User className="w-3 h-3" />}
            </div>
          )}

          {/* Node Text Content */}
          <div className="flex items-center gap-2">
            {isTeam ? (
              <>
                <span className="font-semibold text-sky-700 dark:text-sky-300">
                  Team:{" "}
                  <span className="text-text-primary font-medium">
                    {node.name}
                  </span>
                </span>
                {typeof node.memberCount === "number" && (
                  <Badge
                    size="sm"
                    variant="neutral"
                    className="text-[10px] px-1.5 py-0 font-mono"
                  >
                    {node.memberCount}{" "}
                    {node.memberCount === 1 ? "member" : "members"}
                  </Badge>
                )}
              </>
            ) : (
              /* Just display the role followed by name */
              <span className="font-medium text-text-primary">
                <span
                  className={clsx(
                    "font-semibold",
                    isOwner && "text-purple-700 dark:text-purple-300",
                    isManager && "text-emerald-700 dark:text-emerald-300",
                    !isOwner && !isManager && "text-text-secondary",
                  )}
                >
                  {node.role ||
                    (isOwner
                      ? "Branch Owner"
                      : isManager
                        ? "Manager"
                        : "Employee")}
                  :{" "}
                </span>
                <span>{node.name}</span>
              </span>
            )}

            {/* Status dot for individual people */}
            {!isTeam && node.status && <StatusDot status={node.status} />}

            {/* Profile button for all individual people */}
            {!isTeam && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMember(node);
                }}
                className={clsx(
                  "ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer",
                  isOwner &&
                    "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25",
                  isManager &&
                    "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25",
                  isEmployee &&
                    "bg-surface-secondary border-border/70 text-text-secondary hover:text-text-primary hover:bg-border/60",
                  node.nodeType === "unassigned" &&
                    "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25",
                )}
                title={`View ${node.name}'s profile details`}
              >
                Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested Sub-Tree (Indented with connector line) */}
      {hasChildren && isOpen && (
        <div className="relative ml-5 pl-5 border-l border-border/80 dark:border-border/60 space-y-0.5 mt-0.5">
          {node.children!.map((child, cIdx) => (
            <HierarchyTreeNode
              key={child.id}
              node={child}
              isLast={cIdx === node.children!.length - 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              onSelectMember={onSelectMember}
              matchingNodeIds={matchingNodeIds}
              search={search}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               HELPER WIDGETS                               */
/* -------------------------------------------------------------------------- */

function StatusDot({
  status,
  showLabel = false,
}: {
  status: StatusType;
  showLabel?: boolean;
}) {
  const configs = {
    ACTIVE: {
      color: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "Active",
      badge: "success" as const,
    },
    INACTIVE: {
      color: "bg-slate-400 dark:bg-slate-600",
      text: "text-text-tertiary",
      label: "Inactive",
      badge: "neutral" as const,
    },
    ON_LEAVE: {
      color: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      label: "On Leave",
      badge: "warning" as const,
    },
  };

  const current = configs[status] || configs.ACTIVE;

  if (showLabel) {
    return (
      <Badge size="sm" variant={current.badge} className="gap-1.5">
        <span className={clsx("w-1.5 h-1.5 rounded-full", current.color)} />
        {current.label}
      </Badge>
    );
  }

  return (
    <span
      className={clsx(
        "w-2 h-2 rounded-full inline-block shrink-0",
        current.color,
      )}
      title={`Status: ${current.label}`}
    />
  );
}

function NodeBadge({ nodeType }: { nodeType: NodeType }) {
  switch (nodeType) {
    case "owner":
      return (
        <Badge
          size="sm"
          variant="accent"
          className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
        >
          <Crown className="w-2.5 h-2.5 mr-1" />
          Branch Owner
        </Badge>
      );
    case "team":
      return (
        <Badge
          size="sm"
          variant="accent"
          className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
        >
          <Users className="w-2.5 h-2.5 mr-1" />
          Department Team
        </Badge>
      );
    case "manager":
      return (
        <Badge
          size="sm"
          variant="accent"
          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
        >
          <Briefcase className="w-2.5 h-2.5 mr-1" />
          Team Manager
        </Badge>
      );
    case "unassigned":
      return (
        <Badge size="sm" variant="warning">
          <HelpCircle className="w-2.5 h-2.5 mr-1" />
          Unassigned
        </Badge>
      );
    default:
      return (
        <Badge size="sm" variant="neutral">
          <User className="w-2.5 h-2.5 mr-1" />
          Employee
        </Badge>
      );
  }
}
