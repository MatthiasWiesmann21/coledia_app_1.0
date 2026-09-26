"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Video,
  Heart,
  CheckCircle2,
  ArrowLeft,
  Play,
  MapPin,
  CalendarPlus,
  Bookmark,
} from "lucide-react";
import { Button } from "@coledia/ui/button";
import { useTranslations } from "next-intl";

type EventData = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  startAt: string;
  endAt?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  streamChatEnabled: boolean;
  registrationCount: number;
  location?: string | null;
  maxAttendees?: number | null;
};

function formatStartsIn(ms: number, t: ReturnType<typeof useTranslations>): string {
  const hours = Math.ceil(ms / (1000 * 60 * 60));
  if (hours < 24) return t("startsInHours", { count: hours });
  const days = Math.ceil(hours / 24);
  return t("startsInDays", { count: days });
}

function getEmbedUrl(url: string, type: string): string {
  if (type === "youtube") {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }
  if (type === "vimeo") {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : url;
  }
  return url;
}

export function EventDetail({
  event,
  isRegistered,
  liked,
  likeCount,
  favourited,
  isLoggedIn,
  registerAction,
  likeAction,
  favouriteAction,
}: {
  event: EventData;
  isRegistered: boolean;
  liked: boolean;
  likeCount: number;
  favourited?: boolean;
  isLoggedIn: boolean;
  registerAction: (eventId: string) => Promise<any>;
  likeAction: (eventId: string) => Promise<any>;
  favouriteAction?: (eventId: string) => Promise<any>;
}) {
  const t = useTranslations("events");
  const [registered, setRegistered] = useState(isRegistered);
  const [regCount, setRegCount] = useState(event.registrationCount);
  const [isLiked, setIsLiked] = useState(liked);
  const [isFav, setIsFav] = useState(favourited ?? false);
  const [likes, setLikes] = useState(likeCount);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const eventDate = new Date(event.startAt);
  const endDate = event.endAt ? new Date(event.endAt) : null;
  const now = new Date();
  const isLive = now >= eventDate && (!endDate || now <= endDate);
  const isPast = endDate ? now > endDate : now > eventDate;
  const isFull =
    event.maxAttendees != null && regCount >= event.maxAttendees && !registered;

  async function handleRegister() {
    if (!isLoggedIn) {
      window.location.href = "/sign-in";
      return;
    }
    setRegistering(true);
    setRegError(null);
    setRegistered(!registered);
    setRegCount(registered ? regCount - 1 : regCount + 1);
    try {
      await registerAction(event.id);
    } catch (e) {
      setRegistered(registered);
      setRegCount(regCount);
      setRegError(
        e instanceof Error && e.message.includes("full")
          ? t("eventFullMsg")
          : t("registrationFailed"),
      );
    }
    setRegistering(false);
  }

  async function handleLike() {
    if (!isLoggedIn) {
      window.location.href = "/sign-in";
      return;
    }
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
    try {
      await likeAction(event.id);
    } catch {
      setIsLiked(isLiked);
      setLikes(likes);
    }
  }

  async function handleFavourite() {
    if (!isLoggedIn || !favouriteAction) return;
    setIsFav(!isFav);
    try {
      await favouriteAction(event.id);
    } catch {
      setIsFav(isFav);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("allEvents")}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Video / Thumbnail */}
          <div className="overflow-hidden rounded-xl bg-black">
            {isLive && event.videoUrl ? (
              event.videoType === "external" ? (
                <a
                  href={event.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-72 items-center justify-center text-white hover:underline"
                >
                  {t("openStream")} →
                </a>
              ) : (
                <iframe
                  src={getEmbedUrl(event.videoUrl, event.videoType ?? "youtube")}
                  className="h-72 w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : event.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.thumbnailUrl}
                alt={event.title}
                className="h-72 w-full object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center">
                <Video className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Live badge */}
          {isLive && (
            <div className="mt-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                {t("liveNow")}
              </span>
              {event.streamChatEnabled && (
                <span className="text-xs text-muted-foreground">
                  {t("streamChatEnabled")}
                </span>
              )}
            </div>
          )}

          {/* Title + meta */}
          <h1 className="mt-4 text-2xl font-bold">{event.title}</h1>

          {event.categoryName && (
            <span
              className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: `${event.categoryColor ?? "#008080"}20`,
                color: event.categoryColor ?? "#008080",
              }}
            >
              {event.categoryName}
            </span>
          )}

          {/* Date/time */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {eventDate.toLocaleDateString()}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {eventDate.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
              {endDate && (
                <>
                  {" – "}
                  {endDate.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                </>
              )}
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {event.maxAttendees != null
                ? t("registeredOf", { count: regCount, max: event.maxAttendees })
                : t("registeredCount", { count: regCount })}
            </span>
            {event.location && (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-2 text-lg font-semibold">{t("aboutEvent")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-xl border border-border bg-card p-6">
            {isPast ? (
              <p className="text-center text-sm text-muted-foreground">
                {t("eventEnded")}
              </p>
            ) : isLive ? (
              <div className="flex flex-col gap-3">
                <p className="text-center text-sm font-medium text-red-500">
                  {t("eventLive")}
                </p>
                {registered ? (
                  <RegisteredState onCancel={handleRegister} disabled={registering} />
                ) : isFull ? (
                  <Button disabled className="w-full">{t("eventFull")}</Button>
                ) : (
                  <Button onClick={handleRegister} disabled={registering} className="w-full">
                    {registering ? "..." : t("registerNow")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t("startsIn")}</p>
                  <p className="text-lg font-bold">
                    {formatStartsIn(eventDate.getTime() - now.getTime(), t)}
                  </p>
                </div>
                {registered ? (
                  <RegisteredState onCancel={handleRegister} disabled={registering} />
                ) : isFull ? (
                  <Button disabled className="w-full">{t("eventFull")}</Button>
                ) : (
                  <Button onClick={handleRegister} disabled={registering} className="w-full">
                    {registering ? "..." : t("register")}
                  </Button>
                )}
              </div>
            )}

            {regError && (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-500">
                {regError}
              </p>
            )}

            {!isPast && (
              <a
                href={`/api/events/${event.id}/ics`}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted"
              >
                <CalendarPlus className="h-4 w-4" />
                {t("addToCalendar")}
              </a>
            )}

            {/* Like + favourite buttons */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleLike}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                  isLiked
                    ? "bg-red-500/15 text-red-500"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                {likes}
              </button>
              {favouriteAction && (
                <button
                  onClick={handleFavourite}
                  aria-label={t("saveFavourite")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                    isFav
                      ? "bg-primary/15 text-primary"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisteredState({
  onCancel,
  disabled,
}: {
  onCancel: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("events");
  return (
    <div className="flex flex-col gap-1">
      <Button disabled className="w-full">
        <CheckCircle2 className="mr-1 h-4 w-4" />
        {t("registered")}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
      >
        {t("cancelRegistration")}
      </button>
    </div>
  );
}
