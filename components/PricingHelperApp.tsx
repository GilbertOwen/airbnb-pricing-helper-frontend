"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, MapPin, CalendarDays, DollarSign } from "lucide-react";

/**
 * Expected backend endpoints:
 * - GET  /health
 * - POST /recommend_by_index           { row_index, weekend_flag, holiday_flag }
 * - POST /recommend_from_features     { room_type, ... }
 * - POST /booking_week_by_index       { row_index, start_date, base_price }
 * - POST /booking_week_from_features  { start_date, base_price, room_type, ... }
 */

const API_BASE_DEFAULT = "http://localhost:8000";

// ---------------- Types ----------------

type HealthResponse = {
  status: string;
  n_rows: number;
  booking_model_loaded: boolean;
};

type RecommendResponse = {
  row_index: number;
  listing_id?: number | null;
  city?: string | null;
  neighbourhood?: string | null;
  peer_median_price: number;
  regression_price: number;
  final_price: number;
  price_bucket_static?: string | null;
};

type BookingDayResult = {
  date: string;
  effective_price: number;
  prob_booked_pct: number;
  prob_vacant_pct: number;
};

type BookingWeekResponse = {
  row_index: number;
  base_price: number;
  results: BookingDayResult[];
};

type RecommendByIndexBody = {
  row_index: number;
  weekend_flag: boolean;
  holiday_flag: boolean;
};

type RecommendFromFeaturesBody = {
  room_type: string;
  property_type?: string | null;
  accommodates: number;
  bathrooms?: number | null;
  amenities?: string | null;
  minimum_nights: number;
  instant_bookable: boolean;
  review_scores_rating?: number | null;
  number_of_reviews?: number | null;
  host_is_superhost: boolean;
  latitude?: number | null;
  longitude?: number | null;
  weekend_flag: boolean;
  holiday_flag: boolean;
};

type BookingWeekBody = {
  row_index: number;
  start_date: string;
  base_price: number;
};

// [BARU] Gabungan input features + booking params
type BookingWeekFromFeaturesBody = RecommendFromFeaturesBody & {
  start_date: string;
  base_price: number;
};

// ---------------- Helpers ----------------

function fmtMoney(n: unknown): string {
  const num = Number(n);
  if (n === null || n === undefined || Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function fmtPct(n: unknown): string {
  const num = Number(n);
  if (n === null || n === undefined || Number.isNaN(num)) return "-";
  return `${num.toFixed(1)}%`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  apiBase: string
): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      (data as any)?.detail ||
      (data as any)?.message ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

// ---------------- Component ----------------

export default function PricingHelperApp(): any {
  const [apiBase, setApiBase] = useState<string>(API_BASE_DEFAULT);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [healthErr, setHealthErr] = useState<string>("");

  // Tab: Example (by row_index)
  const [rowIndex, setRowIndex] = useState<string>("0");
  const [weekendFlag, setWeekendFlag] = useState<boolean>(false);
  const [holidayFlag, setHolidayFlag] = useState<boolean>(false);

  // Tab: Custom
  const [roomType, setRoomType] = useState<string>("Entire home/apt");
  const [propertyType, setPropertyType] = useState<string>("House");
  const [accommodates, setAccommodates] = useState<string>("2");
  const [bathrooms, setBathrooms] = useState<string>("1");
  const [amenities, setAmenities] = useState<string>("Wifi,Kitchen,Heating");
  const [minimumNights, setMinimumNights] = useState<string>("1");
  const [instantBookable, setInstantBookable] = useState<boolean>(false);
  const [superhost, setSuperhost] = useState<boolean>(false);
  const [rating, setRating] = useState<string>("4.8");
  const [reviews, setReviews] = useState<string>("10");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");

  // Results
  const [recLoading, setRecLoading] = useState<boolean>(false);
  const [recErr, setRecErr] = useState<string>("");
  const [rec, setRec] = useState<RecommendResponse | null>(null);

  // Track which tab is active: "example" or "custom"
  const [activeMode, setActiveMode] = useState<"example" | "custom">("example");

  // Booking
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [basePrice, setBasePrice] = useState<string>("");
  const [bookLoading, setBookLoading] = useState<boolean>(false);
  const [bookErr, setBookErr] = useState<string>("");
  const [bookWeek, setBookWeek] = useState<BookingWeekResponse | null>(null);

  const recommendedPrice = useMemo<string>(() => {
    const v = rec?.final_price;
    if (v === undefined || v === null) return "";
    return String(Math.round(Number(v)));
  }, [rec]);

  async function checkHealth(): Promise<void> {
    setHealthErr("");
    setHealthLoading(true);
    try {
      const data = await apiFetch<HealthResponse>(
        "/health",
        { method: "GET" },
        apiBase
      );
      setHealth(data);
    } catch (e) {
      setHealth(null);
      setHealthErr(e instanceof Error ? e.message : String(e));
    } finally {
      setHealthLoading(false);
    }
  }

  async function recommendExample(): Promise<void> {
    setRecErr("");
    setRecLoading(true);
    setRec(null);
    setBookWeek(null);
    setBookErr("");

    try {
      const body: RecommendByIndexBody = {
        row_index: Number(rowIndex),
        weekend_flag: Boolean(weekendFlag),
        holiday_flag: Boolean(holidayFlag),
      };

      const data = await apiFetch<RecommendResponse>(
        "/recommend_by_index",
        { method: "POST", body: JSON.stringify(body) },
        apiBase
      );

      setRec(data);
      setActiveMode("example");
      setBasePrice(String(Math.round(Number(data.final_price))));
    } catch (e) {
      setRecErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRecLoading(false);
    }
  }

  async function recommendCustom(): Promise<void> {
    setRecErr("");
    setRecLoading(true);
    setRec(null);
    setBookWeek(null);
    setBookErr("");

    try {
      const body: RecommendFromFeaturesBody = {
        room_type: roomType,
        property_type: propertyType || null,
        accommodates: Number(accommodates),
        bathrooms: bathrooms === "" ? null : Number(bathrooms),
        amenities: amenities || null,
        minimum_nights: Number(minimumNights || 1),
        instant_bookable: Boolean(instantBookable),
        review_scores_rating: rating === "" ? null : Number(rating),
        number_of_reviews: reviews === "" ? null : Number(reviews),
        host_is_superhost: Boolean(superhost),
        latitude: latitude === "" ? null : Number(latitude),
        longitude: longitude === "" ? null : Number(longitude),
        weekend_flag: Boolean(weekendFlag),
        holiday_flag: Boolean(holidayFlag),
      };

      const data = await apiFetch<RecommendResponse>(
        "/recommend_from_features",
        { method: "POST", body: JSON.stringify(body) },
        apiBase
      );

      setRec(data);
      setActiveMode("custom");
      setBasePrice(String(Math.round(Number(data.final_price))));
    } catch (e) {
      setRecErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRecLoading(false);
    }
  }

  // [UPDATED] Fungsi ini sekarang pintar memilih endpoint
  // Ganti keseluruhan fungsi predictBookingWeek dengan ini:
  async function predictBookingWeek(): Promise<void> {
    setBookErr("");
    setBookLoading(true);
    setBookWeek(null);

    try {
      if (!basePrice) throw new Error("Base price is empty. Fill it first.");
      if (!startDate) throw new Error("Start date is empty.");

      // KASUS A: Menggunakan Listing dari Dataset (Row Index)
      if (activeMode === "example") {
        const body: BookingWeekBody = {
          row_index: Number(rowIndex),
          start_date: startDate,
          base_price: Number(basePrice),
        };

        const data = await apiFetch<BookingWeekResponse>(
          "/booking_week_by_index",
          { method: "POST", body: JSON.stringify(body) },
          apiBase
        );
        setBookWeek(data);
      }

      // KASUS B: Menggunakan Custom Listing (Features Input User)
      else {
        // Kita kirim semua fitur yang ada di form + tanggal & harga
        const body: BookingWeekFromFeaturesBody = {
          start_date: startDate,
          base_price: Number(basePrice),

          // Fitur Listing dari State
          room_type: roomType,
          property_type: propertyType || null,
          accommodates: Number(accommodates),
          bathrooms: bathrooms === "" ? null : Number(bathrooms),
          amenities: amenities || null,
          minimum_nights: Number(minimumNights || 1),
          instant_bookable: Boolean(instantBookable),
          review_scores_rating: rating === "" ? null : Number(rating),
          number_of_reviews: reviews === "" ? null : Number(reviews),
          host_is_superhost: Boolean(superhost),
          latitude: latitude === "" ? null : Number(latitude),
          longitude: longitude === "" ? null : Number(longitude),
          weekend_flag: Boolean(weekendFlag),
          holiday_flag: Boolean(holidayFlag),
        };

        const data = await apiFetch<BookingWeekResponse>(
          "/booking_week_from_features",
          { method: "POST", body: JSON.stringify(body) },
          apiBase
        );
        setBookWeek(data);
      }
    } catch (e) {
      setBookErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBookLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Seattle Airbnb Pricing Helper
          </h1>
          <p className="text-sm text-muted-foreground">
            Recommend nightly prices and simulate 7-day booking probability.
            Backend: FastAPI.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">API Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>API Base URL</Label>
                <Input
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  placeholder="http://localhost:8000"
                />
                <p className="text-xs text-muted-foreground">
                  If you run the backend locally, keep the default.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={checkHealth}
                  disabled={healthLoading}
                  className="w-full"
                >
                  {healthLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                    </span>
                  ) : (
                    "Check /health"
                  )}
                </Button>
              </div>

              {healthErr ? (
                <Alert variant="destructive">
                  <AlertTitle>Connection error</AlertTitle>
                  <AlertDescription>{healthErr}</AlertDescription>
                </Alert>
              ) : null}

              {health ? (
                <div className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">{health.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Rows</span>
                    <span className="font-medium">{health.n_rows}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Booking model</span>
                    <span className="font-medium">
                      {health.booking_model_loaded ? "Loaded" : "Not loaded"}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-sm">Weekend</span>
                  </div>
                  <Switch
                    checked={weekendFlag}
                    onCheckedChange={setWeekendFlag}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-sm">Holiday</span>
                  </div>
                  <Switch
                    checked={holidayFlag}
                    onCheckedChange={setHolidayFlag}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  These flags apply an uplift after the base recommendation.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Price Recommendation</CardTitle>
            </CardHeader>

            <CardContent>
              <Tabs
                defaultValue="example"
                className="w-full"
                onValueChange={(val) =>
                  setActiveMode(val as "example" | "custom")
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="example">Example Listing</TabsTrigger>
                  <TabsTrigger value="custom">Custom Listing</TabsTrigger>
                </TabsList>

                <TabsContent value="example" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        row_index (from features_listings_with_peer.parquet)
                      </Label>
                      <Input
                        value={rowIndex}
                        onChange={(e) => setRowIndex(e.target.value)}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use this mode for demo/testing. The server will load all
                        listing features by index.
                      </p>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={recommendExample}
                        disabled={recLoading}
                        className="w-full"
                      >
                        {recLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Predicting…
                          </span>
                        ) : (
                          "Recommend price"
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Room type</Label>
                      <Select value={roomType} onValueChange={setRoomType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Entire home/apt">
                            Entire home/apt
                          </SelectItem>
                          <SelectItem value="Private room">
                            Private room
                          </SelectItem>
                          <SelectItem value="Shared room">
                            Shared room
                          </SelectItem>
                          <SelectItem value="Hotel room">Hotel room</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Property type</Label>
                      <Input
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                        placeholder="House"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Accommodates</Label>
                      <Input
                        value={accommodates}
                        onChange={(e) => setAccommodates(e.target.value)}
                        type="number"
                        min={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Bathrooms</Label>
                      <Input
                        value={bathrooms}
                        onChange={(e) => setBathrooms(e.target.value)}
                        type="number"
                        step="0.5"
                        min={0}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Amenities (comma-separated)</Label>
                      <Input
                        value={amenities}
                        onChange={(e) => setAmenities(e.target.value)}
                        placeholder="Wifi,Kitchen,Heating"
                      />
                      <p className="text-xs text-muted-foreground">
                        For now we use a simple amenity count (amenity_score).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Minimum nights</Label>
                      <Input
                        value={minimumNights}
                        onChange={(e) => setMinimumNights(e.target.value)}
                        type="number"
                        min={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rating (optional)</Label>
                      <Input
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
                        type="number"
                        step="0.1"
                        min={0}
                        max={5}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Number of reviews (optional)</Label>
                      <Input
                        value={reviews}
                        onChange={(e) => setReviews(e.target.value)}
                        type="number"
                        min={0}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Latitude (optional)
                      </Label>
                      <Input
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="47.6"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Longitude (optional)
                      </Label>
                      <Input
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="-122.3"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3 md:col-span-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Instant bookable
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Whether guests can book instantly.
                        </div>
                      </div>
                      <Switch
                        checked={instantBookable}
                        onCheckedChange={setInstantBookable}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-3 md:col-span-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Superhost</div>
                        <div className="text-xs text-muted-foreground">
                          Host has superhost status.
                        </div>
                      </div>
                      <Switch
                        checked={superhost}
                        onCheckedChange={setSuperhost}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Button
                        onClick={recommendCustom}
                        disabled={recLoading}
                        className="w-full"
                      >
                        {recLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Predicting…
                          </span>
                        ) : (
                          "Recommend price"
                        )}
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        This endpoint uses Seattle dataset medians as a peer
                        baseline.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {recErr ? (
                <div className="mt-4">
                  <Alert variant="destructive">
                    <AlertTitle>Prediction error</AlertTitle>
                    <AlertDescription>{recErr}</AlertDescription>
                  </Alert>
                </div>
              ) : null}

              {rec ? (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Peer median
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-lg font-semibold">
                      {fmtMoney(rec.peer_median_price)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Regression
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-lg font-semibold">
                      {fmtMoney(rec.regression_price)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Final (uplifted)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />{" "}
                      {fmtMoney(rec.final_price)}
                    </CardContent>
                  </Card>

                  <div className="md:col-span-3 rounded-xl border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-medium">Context</div>
                        <div className="text-xs text-muted-foreground">
                          {rec.neighbourhood
                            ? `Neighbourhood: ${rec.neighbourhood}`
                            : ""}{" "}
                          {rec.city ? `• City: ${rec.city}` : ""}
                          {rec.listing_id
                            ? `• Listing ID: ${rec.listing_id}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rec.price_bucket_static
                          ? `Price bucket: ${rec.price_bucket_static}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      7-Day Booking Probability
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Simulate booking probability for a chosen base price.
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      type="date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Base price</Label>
                    <Input
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder={recommendedPrice || "e.g., 120"}
                      type="number"
                      min={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: use the final price above, then tweak it manually.
                    </p>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={predictBookingWeek}
                      disabled={bookLoading}
                      className="w-full"
                    >
                      {bookLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />{" "}
                          Simulating…
                        </span>
                      ) : (
                        "Predict 7 days"
                      )}
                    </Button>
                  </div>
                </div>

                {bookErr ? (
                  <div className="mt-4">
                    <Alert variant="destructive">
                      <AlertTitle>Booking prediction error</AlertTitle>
                      <AlertDescription>{bookErr}</AlertDescription>
                    </Alert>
                  </div>
                ) : null}

                {bookWeek?.results?.length ? (
                  <div className="mt-4 overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-4 gap-0 bg-muted px-3 py-2 text-xs font-medium">
                      <div>Date</div>
                      <div>Price</div>
                      <div>Booked</div>
                      <div>Vacant</div>
                    </div>
                    {bookWeek.results.map((r) => (
                      <div
                        key={r.date}
                        className="grid grid-cols-4 gap-0 px-3 py-2 text-sm border-t"
                      >
                        <div>{r.date}</div>
                        <div>{fmtMoney(r.effective_price)}</div>
                        <div className="font-medium">
                          {fmtPct(r.prob_booked_pct)}
                        </div>
                        <div className="text-muted-foreground">
                          {fmtPct(r.prob_vacant_pct)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <p className="mt-3 text-xs text-muted-foreground">
                  Now simulating booking probability for your{" "}
                  <strong>{activeMode}</strong> listing configuration.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-xs text-muted-foreground">
          <div className="font-medium">Backend checklist</div>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              Run:{" "}
              <span className="font-mono">
                uvicorn app:app --reload --port 8000
              </span>
            </li>
            <li>
              Enable CORS in FastAPI if frontend runs on a different origin
              (e.g., localhost:3000).
            </li>
            <li>
              Ensure artifacts exist:{" "}
              <span className="font-mono">
                features_listings_with_peer.parquet
              </span>
              , <span className="font-mono">price_reg.pkl</span>, and (optional){" "}
              <span className="font-mono">booking_clf.pkl</span>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
