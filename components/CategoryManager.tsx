"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, X, Search, GripVertical, Lock, Info } from "lucide-react";
import { DbCategory, SYSTEM_CATEGORIES } from "@/lib/db";

// Descriptions for system categories
const SYSTEM_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  [SYSTEM_CATEGORIES.UNCATEGORIZED]: "Transactions that don't match any category keywords. This category cannot be edited.",
  [SYSTEM_CATEGORIES.EXCLUDED]: "Transactions excluded from all reports and budgets. Can be used for transfers between accounts etc.",
  [SYSTEM_CATEGORIES.INCOME]: "Income transactions such as salary, deposits, and refunds. Excluded from expense budgets.",
};
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CategoryManagerProps {
  categories: DbCategory[];
  onCategoryAdd: (name: string, keywords: string[]) => Promise<void> | void;
  onCategoryUpdate: (id: number, name: string, keywords: string[]) => Promise<void> | void;
  onCategoryDelete: (id: number) => Promise<void> | void;
  onCategoryReorder: (activeId: number, overId: number) => Promise<void> | void;
  singleColumn?: boolean;
  getTransactionCount?: (categoryUuid: string) => number;
}

// Component to dynamically show as many keyword tags as fit on one line
function DynamicKeywordList({ keywords }: { keywords: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);

  useLayoutEffect(() => {
    if (!containerRef.current || !measureRef.current || keywords.length === 0) return;

    const calculateVisibleCount = () => {
      const container = containerRef.current;
      const measureContainer = measureRef.current;
      if (!container || !measureContainer) return;

      // Force a reflow to get accurate measurements
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth === 0) return;

      const children = Array.from(measureContainer.children) as HTMLElement[];
      if (children.length === 0) return;

      let totalWidth = 0;
      let count = 0;
      const gap = 4; // gap-1 = 0.25rem = 4px

      // Measure the "+x more" badge width from the last child in measure container
      const moreTagEl = measureContainer.querySelector('[data-more-tag]') as HTMLElement;
      const moreTagWidth = moreTagEl ? moreTagEl.getBoundingClientRect().width : 60;

      // Only measure keyword badges (not the more tag)
      const keywordBadges = children.filter(c => !c.hasAttribute('data-more-tag'));

      for (let i = 0; i < keywordBadges.length; i++) {
        const child = keywordBadges[i];
        const childWidth = child.getBoundingClientRect().width;
        const widthWithGap = count > 0 ? childWidth + gap : childWidth;

        // Check if we need space for "+x more"
        const remainingItems = keywords.length - (count + 1);
        const needsMoreTag = remainingItems > 0;
        const reservedSpace = needsMoreTag ? moreTagWidth + gap : 0;

        if (totalWidth + widthWithGap + reservedSpace <= containerWidth) {
          totalWidth += widthWithGap;
          count++;
        } else {
          break;
        }
      }

      setVisibleCount(Math.max(1, count));
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(calculateVisibleCount);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(calculateVisibleCount);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [keywords]);

  if (keywords.length === 0) {
    return <span className="text-xs text-muted-foreground">No keywords</span>;
  }

  const displayedKeywords = keywords.slice(-visibleCount).reverse();
  const hiddenCount = keywords.length - visibleCount;

  return (
    <div ref={containerRef} className="w-full min-w-0">
      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        className="flex gap-1 h-0 overflow-hidden"
        aria-hidden="true"
      >
        {keywords.slice().reverse().map((keyword, idx) => (
          <Badge key={`measure-${idx}`} variant="outline" className="text-xs max-w-[120px]">
            <span className="truncate">{keyword}</span>
          </Badge>
        ))}
        <Badge data-more-tag variant="secondary" className="text-xs">
          +{keywords.length} more
        </Badge>
      </div>
      {/* Visible container - clips overflow as safety net */}
      <div className="flex gap-1 overflow-hidden">
        <TooltipProvider>
          {displayedKeywords.map((keyword, idx) => (
            <Tooltip key={`visible-${idx}`}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs max-w-[120px] flex-shrink-0 inline-flex">
                  <span className="truncate">{keyword}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{keyword}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
        {hiddenCount > 0 && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            +{hiddenCount} more
          </Badge>
        )}
      </div>
    </div>
  );
}

interface SortableItemProps {
  category: DbCategory;
  onEdit: (category: DbCategory) => void;
  onDeleteConfirm: (category: DbCategory) => void;
}

function SortableItem({ category, onEdit, onDeleteConfirm }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSystemCategory = category.isSystem;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start justify-between p-3 bg-card border rounded-lg"
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <button
          className="self-center cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{category.name}</h4>
            {isSystemCategory && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1 px-1.5">
                      <Lock className="h-3 w-3" />
                      System
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>System category - cannot be deleted</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="mt-2">
            <DynamicKeywordList keywords={category.keywords} />
          </div>
        </div>
      </div>
      <div className="flex space-x-1 self-center">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(category)}
          disabled={category.name?.toLowerCase() === 'uncategorized'}
          title={category.name?.toLowerCase() === 'uncategorized' ? "Uncategorized cannot be edited" : "Edit category"}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDeleteConfirm(category)}
          disabled={isSystemCategory}
          title={isSystemCategory ? "System categories cannot be deleted" : "Delete category"}
        >
          <Trash2 className={`h-4 w-4 ${isSystemCategory ? "text-muted-foreground" : "text-destructive"}`} />
        </Button>
      </div>
    </div>
  );
}

export function CategoryManager({
  categories,
  onCategoryAdd,
  onCategoryUpdate,
  onCategoryDelete,
  onCategoryReorder,
  singleColumn = false,
  getTransactionCount,
}: CategoryManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DbCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [keywordError, setKeywordError] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<DbCategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      onCategoryReorder(active.id as number, over.id as number);
    }
  };

  const checkKeywordExists = (keyword: string): { exists: boolean; categoryName?: string } => {
    const keywordLower = keyword.toLowerCase();

    // Check in other categories (excluding current category being edited)
    for (const category of categories) {
      if (editingCategory && category.id === editingCategory.id) continue;

      if (category.keywords.some(k => k.toLowerCase() === keywordLower)) {
        return { exists: true, categoryName: category.name };
      }
    }

    return { exists: false };
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await onCategoryAdd(newCategoryName.trim(), keywords);
    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) return;
    await onCategoryUpdate(editingCategory.id!, newCategoryName.trim(), keywords);
    resetForm();
    setEditingCategory(null);
  };

  const handleAddKeyword = (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    // Check if already in current list
    if (keywords.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
      setKeywordError("This keyword already exists");
      return;
    }

    // Check if exists in other categories
    const check = checkKeywordExists(trimmed);
    if (check.exists) {
      setKeywordError(`Already exists in "${check.categoryName}"`);
      return;
    }

    setKeywords(prev => [...prev, trimmed]);
    setSearchInput("");
    setKeywordError("");
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(prev => prev.filter((k) => k !== keyword));
  };

  const resetForm = () => {
    setNewCategoryName("");
    setKeywords([]);
    setSearchInput("");
    setKeywordError("");
  };

  const openEditDialog = (category: DbCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setKeywords([...category.keywords]);
    setSearchInput("");
    setKeywordError("");
  };

  const closeEditDialog = () => {
    setEditingCategory(null);
    resetForm();
  };

  // Filter keywords based on search, newest first
  const filteredKeywords = keywords
    .filter((keyword) =>
      keyword.toLowerCase().includes(searchInput.toLowerCase())
    )
    .reverse();

  // Check if search input can be added as new keyword
  const canAddSearchAsKeyword = searchInput.trim() &&
    !keywords.some(k => k.toLowerCase() === searchInput.trim().toLowerCase()) &&
    !checkKeywordExists(searchInput.trim()).exists;

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>Category Manager</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0 pb-4">
                <DialogTitle>Add New Category</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-5 overflow-hidden flex-1">
                {/* Category Name */}
                <div className="flex-shrink-0 space-y-2">
                  <Label htmlFor="category-name" className="text-sm text-muted-foreground">Category Name</Label>
                  <Input
                    id="category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Groceries"
                    className="h-10"
                  />
                </div>

                {/* Search/Add Input */}
                <div className="flex-shrink-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Keywords</Label>
                    <Badge variant="secondary" className="text-xs">
                      {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchInput}
                      onChange={(e) => { setSearchInput(e.target.value); setKeywordError(""); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && canAddSearchAsKeyword) {
                          e.preventDefault();
                          handleAddKeyword(searchInput);
                        }
                      }}
                      placeholder="Search or add keyword..."
                      className="pl-9 h-10"
                    />
                  </div>
                  {keywordError && <p className="text-xs text-destructive">{keywordError}</p>}
                </div>

                {/* Keyword List */}
                <div className="flex-1 min-h-0 border rounded-lg overflow-hidden flex flex-col">
                  <div className="overflow-y-auto flex-1 p-1">
                    {/* Add option if search doesn't match */}
                    {canAddSearchAsKeyword && (
                      <button
                        onClick={() => handleAddKeyword(searchInput)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors mb-1"
                      >
                        <Plus className="h-4 w-4 text-primary" />
                        <span className="text-sm">Add &quot;{searchInput.trim()}&quot;</span>
                      </button>
                    )}
                    {filteredKeywords.length > 0 ? (
                      <div className="space-y-0.5">
                        {filteredKeywords.map((keyword) => (
                          <div
                            key={keyword}
                            className="group flex items-start justify-between gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
                          >
                            <span className="font-mono text-sm break-all leading-relaxed">{keyword}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveKeyword(keyword)}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : keywords.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                        No keywords yet. Type above to add.
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                        No matches for &quot;{searchInput}&quot;
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>Create Category</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet. Add one to get started!
          </p>
        ) : (
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
            <div className="h-full overflow-y-auto p-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={categories.map((cat) => cat.id!)}
                  strategy={rectSortingStrategy}
                >
                  <div className={`grid grid-cols-1 ${!singleColumn ? 'xl:grid-cols-2' : ''} gap-2`}>
                    {categories.map((category) => (
                      <SortableItem
                        key={category.id}
                        category={category}
                        onEdit={openEditDialog}
                        onDeleteConfirm={setCategoryToDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editingCategory !== null} onOpenChange={(open) => !open && closeEditDialog()}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0 pb-4">
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 overflow-hidden flex-1">
              {/* System Category Description */}
              {editingCategory?.isSystem && SYSTEM_CATEGORY_DESCRIPTIONS[editingCategory.name] && (
                <div className="flex-shrink-0 flex items-start gap-2 p-3 rounded-lg bg-muted/50 border">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {SYSTEM_CATEGORY_DESCRIPTIONS[editingCategory.name]}
                  </p>
                </div>
              )}

              {/* Category Name */}
              <div className="flex-shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-category-name" className="text-sm text-muted-foreground">Category Name</Label>
                  {editingCategory?.isSystem && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs gap-1 px-1.5">
                            <Lock className="h-3 w-3" />
                            System
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>System category name cannot be changed</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Input
                  id="edit-category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="h-10"
                  disabled={editingCategory?.isSystem}
                />
              </div>

              {/* Search/Add Input */}
              <div className="flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Keywords</Label>
                  <Badge variant="secondary" className="text-xs">
                    {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => { setSearchInput(e.target.value); setKeywordError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canAddSearchAsKeyword) {
                        e.preventDefault();
                        handleAddKeyword(searchInput);
                      }
                    }}
                    placeholder="Search or add keyword..."
                    className="pl-9 h-10"
                  />
                </div>
                {keywordError && <p className="text-xs text-destructive">{keywordError}</p>}
              </div>

              {/* Keyword List */}
              <div className="flex-1 min-h-0 border rounded-lg overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1 p-1">
                  {/* Add option if search doesn't match */}
                  {canAddSearchAsKeyword && (
                    <button
                      onClick={() => handleAddKeyword(searchInput)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors mb-1"
                    >
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="text-sm">Add &quot;{searchInput.trim()}&quot;</span>
                    </button>
                  )}
                  {filteredKeywords.length > 0 ? (
                    <div className="space-y-0.5">
                      {filteredKeywords.map((keyword) => (
                        <div
                          key={keyword}
                          className="group flex items-start justify-between gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <span className="font-mono text-sm break-all leading-relaxed">{keyword}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveKeyword(keyword)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : keywords.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                      No keywords yet. Type above to add.
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                      No matches for &quot;{searchInput}&quot;
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={closeEditDialog}>Cancel</Button>
              <Button onClick={handleUpdateCategory} disabled={!newCategoryName.trim()}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={categoryToDelete !== null} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{categoryToDelete?.name}&quot;?
                {getTransactionCount && categoryToDelete && (() => {
                  const count = getTransactionCount(categoryToDelete.uuid);
                  return count > 0 ? ` This will affect ${count} transaction${count !== 1 ? 's' : ''}.` : '';
                })()}
                {' '}This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (categoryToDelete?.id) {
                    onCategoryDelete(categoryToDelete.id);
                  }
                  setCategoryToDelete(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}
