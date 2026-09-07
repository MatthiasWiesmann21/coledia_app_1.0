"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@coledia/ui/button";
import { Input } from "@coledia/ui/input";
import { Label } from "@coledia/ui/label";
import { Upload, Trash2 } from "lucide-react";
import {
  createCertificateTemplate,
  updateCertificateTemplate,
  deleteCertificateTemplate,
  assignTemplateToCourses,
  type CertificateTemplateInput,
} from "@/lib/certificate-actions";

type Template = CertificateTemplateInput & { id: string };
type CourseOpt = { id: string; title: string };

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", "certificates");
  const res = await fetch("/api/upload/images", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
        </Button>
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          try {
            onChange(await uploadImage(file));
          } catch {
            // surfaced by parent msg
          }
          setUploading(false);
          e.target.value = "";
        }}
      />
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={label} className="h-12 w-auto rounded border border-border object-contain" />
      )}
    </div>
  );
}

export function CertificateTemplateEditor({
  template,
  courses,
  assignedCourseIds,
}: {
  template: Template | null;
  courses: CourseOpt[];
  assignedCourseIds: string[];
}) {
  const t = useTranslations("certificates");

  const [name, setName] = useState(template?.name ?? "");
  const [title, setTitle] = useState(template?.title ?? "Certificate of Completion");
  const [subtitle, setSubtitle] = useState(template?.subtitle ?? "");
  const [bodyText, setBodyText] = useState(template?.bodyText ?? "");
  const [primaryColor, setPrimaryColor] = useState(template?.primaryColor ?? "#0c2340");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(template?.backgroundImageUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(template?.logoUrl ?? "");
  const [signatureName, setSignatureName] = useState(template?.signatureName ?? "");
  const [signatureImageUrl, setSignatureImageUrl] = useState(template?.signatureImageUrl ?? "");
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(assignedCourseIds);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleCourse(id: string) {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setMsg(t("errorNameRequired"));
      return;
    }
    setSaving(true);
    setMsg(null);
    const payload: CertificateTemplateInput = {
      name,
      title,
      subtitle: subtitle || null,
      bodyText: bodyText || null,
      primaryColor,
      backgroundImageUrl: backgroundImageUrl || null,
      logoUrl: logoUrl || null,
      signatureName: signatureName || null,
      signatureImageUrl: signatureImageUrl || null,
      isDefault,
    };
    try {
      if (template) {
        await updateCertificateTemplate(template.id, payload);
        await assignTemplateToCourses(template.id, selectedCourses);
      } else {
        const { id } = await createCertificateTemplate(payload);
        await assignTemplateToCourses(id, selectedCourses);
      }
      setMsg(t("saved"));
    } catch {
      setMsg(t("saveFailed"));
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!template) return;
    setSaving(true);
    try {
      await deleteCertificateTemplate(template.id);
      window.location.href = "/admin/certificates";
    } catch {
      setMsg(t("deleteFailed"));
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Form */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tname">{t("templateName")}</Label>
          <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ttitle">{t("certificateTitle")}</Label>
          <Input id="ttitle" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tsub">{t("subtitle")}</Label>
          <Input id="tsub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tbody">{t("bodyText")}</Label>
          <textarea
            id="tbody"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={3}
            className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="has successfully completed the course {{course}} on {{date}}."
          />
          <p className="text-xs text-muted-foreground">{t("placeholdersHint")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tcolor">{t("primaryColor")}</Label>
          <div className="flex items-center gap-2">
            <input
              id="tcolor"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-border"
            />
            <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-28" />
          </div>
        </div>

        <ImageUploadField label={t("backgroundImage")} value={backgroundImageUrl} onChange={setBackgroundImageUrl} />
        <ImageUploadField label={t("logo")} value={logoUrl} onChange={setLogoUrl} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="tsigname">{t("signatureName")}</Label>
          <Input id="tsigname" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
        </div>
        <ImageUploadField label={t("signatureImage")} value={signatureImageUrl} onChange={setSignatureImageUrl} />

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">{t("isDefault")}</span>
        </label>

        <div className="flex flex-col gap-2">
          <Label>{t("assignToCourses")}</Label>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2">
            {courses.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">{t("noCourses")}</p>
            ) : (
              courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="h-4 w-4"
                  />
                  {c.title}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "..." : t("saveTemplate")}
          </Button>
          {template && (
            <Button variant="outline" onClick={handleDelete} disabled={saving}>
              {t("deleteTemplate")}
            </Button>
          )}
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>

      {/* Live preview (approximation of the PDF layout) */}
      <div>
        <Label className="mb-2 block">{t("preview")}</Label>
        <div
          className="relative aspect-842/595 w-full overflow-hidden rounded-lg border-4 shadow-sm"
          style={{ borderColor: primaryColor, background: "#fff" }}
        >
          {backgroundImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="mb-1 h-10 object-contain" />
            )}
            <p className="text-lg font-bold" style={{ color: primaryColor }}>{title}</p>
            {subtitle && <p className="text-xs italic text-gray-500">{subtitle}</p>}
            <p className="mt-1 text-base font-bold text-gray-900">Max Muster</p>
            <p className="max-w-md text-[10px] text-gray-500">
              {(bodyText || "has successfully completed the course {{course}} on {{date}}.")
                .replaceAll("{{name}}", "Max Muster")
                .replaceAll("{{course}}", "Example Course")
                .replaceAll("{{date}}", new Date().toLocaleDateString())}
            </p>
            <p className="text-sm font-bold" style={{ color: primaryColor }}>Example Course</p>
            {signatureName && (
              <div className="absolute bottom-4 right-6 text-center">
                {signatureImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureImageUrl} alt="" className="mx-auto h-7 object-contain" />
                )}
                <div className="mt-0.5 border-t border-gray-400 pt-0.5 text-[9px] italic text-gray-500">
                  {signatureName}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
