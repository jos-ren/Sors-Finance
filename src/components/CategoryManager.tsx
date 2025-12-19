"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, X, Search, GripVertical, Check } from "lucide-react";
import { Category } from "@/lib/types";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CategoryManagerProps {
  categories: Category[];
  onCategoryAdd: (name: string, keywords: string[]) => void;
  onCategoryUpdate: (id: string, name: string, keywords: string[]) => void;
  onCategoryDelete: (id: string) => void;
  onCategoryReorder: (activeId: string, overId: string) => void;
}

interface SortableItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

function SortableItem({ category, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start justify-between p-3 bg-secondary rounded-lg"
    >
      <div className="flex items-start gap-2 flex-1">
        <button
          className="self-center cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h4 className="font-medium text-sm">{category.name}</h4>
          <div className="flex flex-wrap gap-1 mt-2">
            {category.keywords.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No keywords
              </span>
            ) : (
              <TooltipProvider>
                <>
                  {category.keywords.slice(-3).reverse().map((keyword) => (
                    <Tooltip key={keyword}>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs max-w-[120px] truncate block">
                          {keyword}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{keyword}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {category.keywords.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{category.keywords.length - 3} more
                    </Badge>
                  )}
                </>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
      <div className="flex space-x-1 self-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(category)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
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
}: CategoryManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      onCategoryReorder(active.id as string, over.id as string);
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

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    onCategoryAdd(newCategoryName.trim(), keywords);
    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !newCategoryName.trim()) return;
    onCategoryUpdate(editingCategory.id, newCategoryName.trim(), keywords);
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
      setKeywords([...keywords, ...validKeywords]);
      setKeywordError("");
    }

    setNewKeywordInput("");
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
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
    setKeywords(keywords.map(k => k === editingKeyword ? trimmedValue : k));
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
      setKeywords([...keywords, ...validKeywords]);
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
    setKeywords(keywords.filter(k => !selectedKeywords.has(k)));
    setSelectedKeywords(new Set());
  };

  const openEditDialog = (category: Category) => {
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Category Manager</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
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
                      <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete ({selectedKeywords.size})
                      </Button>
                    )}
                  </div>
                  {keywordError && (
                    <p className="text-xs text-destructive mt-1">{keywordError}</p>
                  )}
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
              <DialogFooter className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCategory}>Create Category</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet. Add one to get started!
          </p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categories.map((cat) => cat.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {categories.map((category) => (
                    <SortableItem
                      key={category.id}
                      category={category}
                      onEdit={openEditDialog}
                      onDelete={onCategoryDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog
          open={editingCategory !== null}
          onOpenChange={(open) => !open && closeEditDialog()}
        >
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 overflow-hidden flex-1">
              <div className="flex-shrink-0">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="h-9"
                />
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
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete ({selectedKeywords.size})
                    </Button>
                  )}
                </div>
                {keywordError && (
                  <p className="text-xs text-destructive mt-1">{keywordError}</p>
                )}
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
            <DialogFooter className="flex justify-center gap-2 flex-shrink-0">
              <Button variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button onClick={handleUpdateCategory}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
