"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, X, Search, GripVertical, Check, Lock } from "lucide-react";
import { DbCategory, SYSTEM_CATEGORIES } from "@/lib/db";
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
  const [editingCategory, setEditingCategory] = useState<DbCategory | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [keywordError, setKeywordError] = useState("");
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const [editingKeywordValue, setEditingKeywordValue] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<DbCategory | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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

  const handleAddKeyword = () => {
    const input = newKeywordInput.trim();
    if (!input) return;

    // Split by commas and process each keyword
    const inputKeywords = input
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const duplicatesInOtherCategories: string[] = [];
    const duplicatesInCurrentList: string[] = [];
    const validKeywords: string[] = [];

    for (const keyword of inputKeywords) {
      // Check if already in current list
      if (keywords.some(existing => existing.toLowerCase() === keyword.toLowerCase())) {
        duplicatesInCurrentList.push(keyword);
        continue;
      }

      // Check if exists in other categories
      const check = checkKeywordExists(keyword);
      if (check.exists) {
        duplicatesInOtherCategories.push(`"${keyword}" (already in ${check.categoryName})`);
      } else {
        validKeywords.push(keyword);
      }
    }

    if (duplicatesInOtherCategories.length > 0) {
      setKeywordError(`Cannot add duplicate keywords: ${duplicatesInOtherCategories.join(', ')}. Each keyword can only exist in one category to avoid conflicts.`);
      return;
    }

    if (validKeywords.length > 0) {
      setKeywords(prev => [...prev, ...validKeywords]);
      setKeywordError("");
    }

    setNewKeywordInput("");
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(prev => prev.filter((k) => k !== keyword));
  };

  const handleStartEditKeyword = (keyword: string) => {
    setEditingKeyword(keyword);
    setEditingKeywordValue(keyword);
    setKeywordError("");
  };

  const handleSaveEditKeyword = () => {
    const trimmedValue = editingKeywordValue.trim();

    if (!trimmedValue) {
      setKeywordError("Keyword cannot be empty");
      return;
    }

    // Check if the new value already exists (and it's not the same keyword)
    if (trimmedValue.toLowerCase() !== editingKeyword?.toLowerCase()) {
      if (keywords.some(k => k.toLowerCase() === trimmedValue.toLowerCase())) {
        setKeywordError("This keyword already exists in the list");
        return;
      }

      // Check if exists in other categories
      const check = checkKeywordExists(trimmedValue);
      if (check.exists) {
        setKeywordError(`"${trimmedValue}" already exists in the "${check.categoryName}" category`);
        return;
      }
    }

    // Update the keyword
    setKeywords(prev => prev.map(k => k === editingKeyword ? trimmedValue : k));
    setEditingKeyword(null);
    setEditingKeywordValue("");
    setKeywordError("");
  };

  const handleCancelEditKeyword = () => {
    setEditingKeyword(null);
    setEditingKeywordValue("");
    setKeywordError("");
  };

  const resetForm = () => {
    setNewCategoryName("");
    setNewKeywordInput("");
    setKeywords([]);
    setKeywordSearch("");
    setKeywordError("");
    setEditingKeyword(null);
    setEditingKeywordValue("");
    setSelectedKeywords(new Set());
    setBulkAddOpen(false);
    setBulkAddText("");
  };

  const handleBulkAdd = () => {
    const lines = bulkAddText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const duplicatesInOtherCategories: string[] = [];
    const duplicatesInCurrentList: string[] = [];
    const validKeywords: string[] = [];

    for (const keyword of lines) {
      if (keywords.some(existing => existing.toLowerCase() === keyword.toLowerCase())) {
        duplicatesInCurrentList.push(keyword);
        continue;
      }

      const check = checkKeywordExists(keyword);
      if (check.exists) {
        duplicatesInOtherCategories.push(`"${keyword}" (already in ${check.categoryName})`);
      } else {
        validKeywords.push(keyword);
      }
    }

    if (duplicatesInOtherCategories.length > 0) {
      setKeywordError(`Cannot add duplicate keywords: ${duplicatesInOtherCategories.join(', ')}`);
      return;
    }

    if (validKeywords.length > 0) {
      setKeywords(prev => [...prev, ...validKeywords]);
      setBulkAddText("");
      setBulkAddOpen(false);
      setKeywordError("");
    }
  };

  const handleToggleKeyword = (keyword: string) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword);
    } else {
      newSelected.add(keyword);
    }
    setSelectedKeywords(newSelected);
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeywords(new Set(filteredKeywords));
    } else {
      setSelectedKeywords(new Set());
    }
  };

  const handleBulkDelete = () => {
    setKeywords(prev => prev.filter(k => !selectedKeywords.has(k)));
    setSelectedKeywords(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const openEditDialog = (category: DbCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setKeywords([...category.keywords]);
    setKeywordSearch("");
    setKeywordError("");
  };

  const closeEditDialog = () => {
    setEditingCategory(null);
    resetForm();
  };

  const handleKeywordInputChange = (value: string) => {
    setNewKeywordInput(value);
    setKeywordError("");
  };

  // Filter keywords based on search and reverse to show newest first
  const filteredKeywords = keywords
    .filter((keyword) =>
      keyword.toLowerCase().includes(keywordSearch.toLowerCase())
    )
    .reverse();

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>Category Manager</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add New Category</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 overflow-hidden flex-1">
                <div className="flex-shrink-0">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category Name (e.g., Groceries)"
                    className="h-9"
                  />
                </div>

                <div className="flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newKeywordInput}
                      onChange={(e) => handleKeywordInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                      placeholder="Add keyword (comma-separated for multiple)"
                      className="h-9 flex-1"
                    />
                    <Button size="sm" onClick={handleAddKeyword} disabled={!newKeywordInput.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {keywordError && (
                    <p className="text-xs text-destructive mt-1">{keywordError}</p>
                  )}
                </div>

                <div className="flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={keywordSearch}
                        onChange={(e) => setKeywordSearch(e.target.value)}
                        placeholder="Search keywords..."
                        className="pl-9 h-9"
                      />
                    </div>
                    <Badge variant="secondary" className="px-2 py-1">
                      {filteredKeywords.length !== keywords.length
                        ? `${filteredKeywords.length}/${keywords.length}`
                        : keywords.length}
                    </Badge>
                    <Popover open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Bulk Add
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Add Multiple Keywords</h4>
                          <p className="text-xs text-muted-foreground">
                            Enter one keyword per line
                          </p>
                          <Textarea
                            value={bulkAddText}
                            onChange={(e) => setBulkAddText(e.target.value)}
                            placeholder="LOBLAWS&#10;METRO&#10;SOBEYS"
                            rows={6}
                            className="font-mono text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setBulkAddOpen(false)}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleBulkAdd}>
                              Add All
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedKeywords.size > 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteConfirm(true)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete ({selectedKeywords.size})
                      </Button>
                    )}
                  </div>
                </div>

                {keywords.length > 0 && (
                  <div className="flex-1 min-h-0 border rounded-md overflow-hidden flex flex-col">
                    <div className="bg-muted border-b flex-shrink-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px] py-2 pl-4">
                              <Checkbox
                                checked={selectedKeywords.size === filteredKeywords.length && filteredKeywords.length > 0}
                                onCheckedChange={handleToggleAll}
                              />
                            </TableHead>
                            <TableHead className="py-2">Keyword</TableHead>
                            <TableHead className="w-[100px] py-2 text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                      </Table>
                    </div>
                    <div className="overflow-auto flex-1">
                      <Table>
                          <TableBody>
                            {filteredKeywords.length > 0 ? (
                              filteredKeywords.map((keyword) => (
                                <TableRow key={keyword} className="group">
                                  <TableCell className="py-2 pl-4">
                                    <Checkbox
                                      checked={selectedKeywords.has(keyword)}
                                      onCheckedChange={() => handleToggleKeyword(keyword)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-mono py-2">
                                    {editingKeyword === keyword ? (
                                      <Input
                                        value={editingKeywordValue}
                                        onChange={(e) => setEditingKeywordValue(e.target.value)}
                                        onKeyPress={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSaveEditKeyword();
                                          } else if (e.key === "Escape") {
                                            handleCancelEditKeyword();
                                          }
                                        }}
                                        className="h-7"
                                        autoFocus
                                      />
                                    ) : (
                                      keyword
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center py-2">
                                    {editingKeyword === keyword ? (
                                      <div className="flex justify-center space-x-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={handleSaveEditKeyword}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Check className="h-4 w-4 text-green-600" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={handleCancelEditKeyword}
                                          className="h-7 w-7 p-0"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleStartEditKeyword(keyword)}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveKeyword(keyword)}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                                  No keywords found matching &quot;{keywordSearch}&quot;
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCategory}>Create Category</Button>
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
        <Dialog
          open={editingCategory !== null}
          onOpenChange={(open) => !open && closeEditDialog()}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 overflow-hidden flex-1">
              <div className="flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category Name"
                    className="h-9 flex-1"
                    disabled={editingCategory?.isSystem}
                  />
                  {editingCategory?.isSystem && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs gap-1 px-1.5 shrink-0">
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
              </div>

              <div className="flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={newKeywordInput}
                    onChange={(e) => handleKeywordInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="Add keyword (comma-separated for multiple)"
                    className="h-9 flex-1"
                  />
                  <Button size="sm" onClick={handleAddKeyword} disabled={!newKeywordInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {keywordError && (
                  <p className="text-xs text-destructive mt-1">{keywordError}</p>
                )}
              </div>

              <div className="flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      placeholder="Search keywords..."
                      className="pl-9 h-9"
                    />
                  </div>
                  <Badge variant="secondary" className="px-2 py-1">
                    {filteredKeywords.length !== keywords.length
                      ? `${filteredKeywords.length}/${keywords.length}`
                      : keywords.length}
                  </Badge>
                  {selectedKeywords.size > 0 && (
                    <Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete ({selectedKeywords.size})
                    </Button>
                  )}
                </div>
              </div>

              {keywords.length > 0 && (
                <div className="flex-1 min-h-0 border rounded-md overflow-hidden flex flex-col">
                  <div className="bg-muted border-b flex-shrink-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px] py-2 pl-4">
                            <Checkbox
                              checked={selectedKeywords.size === filteredKeywords.length && filteredKeywords.length > 0}
                              onCheckedChange={handleToggleAll}
                            />
                          </TableHead>
                          <TableHead className="py-2">Keyword</TableHead>
                          <TableHead className="w-[100px] py-2 text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>
                  <div className="overflow-auto flex-1">
                    <Table>
                        <TableBody>
                          {filteredKeywords.length > 0 ? (
                            filteredKeywords.map((keyword) => (
                              <TableRow key={keyword} className="group">
                                <TableCell className="py-2 pl-4">
                                  <Checkbox
                                    checked={selectedKeywords.has(keyword)}
                                    onCheckedChange={() => handleToggleKeyword(keyword)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono py-2">
                                  {editingKeyword === keyword ? (
                                    <Input
                                      value={editingKeywordValue}
                                      onChange={(e) => setEditingKeywordValue(e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleSaveEditKeyword();
                                        } else if (e.key === "Escape") {
                                          handleCancelEditKeyword();
                                        }
                                      }}
                                      className="h-7"
                                      autoFocus
                                    />
                                  ) : (
                                    keyword
                                  )}
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  {editingKeyword === keyword ? (
                                    <div className="flex justify-center space-x-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSaveEditKeyword}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Check className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCancelEditKeyword}
                                        className="h-7 w-7 p-0"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleStartEditKeyword(keyword)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveKeyword(keyword)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                                No keywords found matching &quot;{keywordSearch}&quot;
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button onClick={handleUpdateCategory}>Save Changes</Button>
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

        {/* Bulk Delete Keywords Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Keywords</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedKeywords.size} keyword{selectedKeywords.size !== 1 ? 's' : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleBulkDelete}
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
