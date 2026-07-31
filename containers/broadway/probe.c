/*
 * probe.c — read-only GTK4 runtime probe (Phase 5, issue #58, ADR 0001 Part 1).
 *
 * Injected into the unmodified packaged GNOME app via LD_PRELOAD inside the
 * Broadway capture container. After the first stable mapped frame it walks
 * the live widget tree and serializes one JSON document to $PROBE_OUTPUT.
 *
 * Containment guarantees (ADR 0001 "Risks and containment"):
 *   - $PROBE_OUTPUT unset  -> the probe does nothing at all.
 *   - GTK never initializes -> the polling thread spins harmlessly; the
 *     capture proceeds probe-less. A missing probe file is "no evidence",
 *     never a failure.
 *   - Read-only: only getter calls on widgets; the sole write is the probe's
 *     own output file (tmp + rename, so consumers never see a partial doc).
 *
 * Threading: the constructor spawns a plain pthread that polls until
 * gdk_display_get_default() is non-NULL, then hands off to the GTK main
 * loop with g_idle_add — the only thread-safe entry point. Every widget
 * access happens on the main thread.
 *
 * Build (see Dockerfile / Dockerfile.fedora):
 *   gcc -shared -fPIC -O2 -o /opt/probe.so probe.c \
 *       $(pkg-config --cflags --libs gtk4) -pthread
 */

#include <gtk/gtk.h>
#include <glib/gstdio.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PROBE_VERSION 1
#define DEFAULT_SETTLE_TICKS 5

static int settle_ticks_target(void) {
  const char *raw = g_getenv("PROBE_SETTLE_TICKS");
  if (raw != NULL) {
    int parsed = atoi(raw);
    if (parsed > 0) return parsed;
  }
  return DEFAULT_SETTLE_TICKS;
}

/* ---------- JSON helpers (manual: the only linked library is gtk4) ------- */

static void json_string(GString *out, const char *value) {
  if (value == NULL) {
    g_string_append(out, "null");
    return;
  }
  g_string_append_c(out, '"');
  for (const char *p = value; *p; p++) {
    unsigned char c = (unsigned char)*p;
    switch (c) {
      case '"': g_string_append(out, "\\\""); break;
      case '\\': g_string_append(out, "\\\\"); break;
      case '\n': g_string_append(out, "\\n"); break;
      case '\r': g_string_append(out, "\\r"); break;
      case '\t': g_string_append(out, "\\t"); break;
      default:
        if (c < 0x20) g_string_append_printf(out, "\\u%04x", c);
        else g_string_append_c(out, (char)c);
    }
  }
  g_string_append_c(out, '"');
}

static const char *align_nick(GtkAlign align) {
  switch (align) {
    case GTK_ALIGN_FILL: return "fill";
    case GTK_ALIGN_START: return "start";
    case GTK_ALIGN_END: return "end";
    case GTK_ALIGN_CENTER: return "center";
    default: return "baseline";
  }
}

/* ---------- widget serialization (main thread only) ---------------------- */

static void append_widget(GString *out, GtkWidget *widget, GtkWidget *toplevel,
                          GArray *index_path, gboolean *first) {
  if (!*first) g_string_append_c(out, ',');
  *first = FALSE;

  g_string_append(out, "\n    {\"gtype\":");
  json_string(out, G_OBJECT_TYPE_NAME(widget));

  g_string_append(out, ",\"buildableId\":");
  /* Every GtkWidget implements GtkBuildable; the id is NULL unless the
   * builder XML (or a template) declared one. */
  json_string(out, gtk_buildable_get_buildable_id(GTK_BUILDABLE(widget)));

  g_string_append(out, ",\"indexPath\":[");
  for (guint i = 0; i < index_path->len; i++) {
    if (i > 0) g_string_append_c(out, ',');
    g_string_append_printf(out, "%d", g_array_index(index_path, int, i));
  }
  g_string_append_c(out, ']');

  g_string_append_printf(out, ",\"mapped\":%s",
                         gtk_widget_get_mapped(widget) ? "true" : "false");
  g_string_append_printf(out, ",\"visible\":%s",
                         gtk_widget_get_visible(widget) ? "true" : "false");

  graphene_rect_t bounds;
  if (gtk_widget_compute_bounds(widget, toplevel, &bounds)) {
    g_string_append_printf(
        out, ",\"bounds\":{\"x\":%.2f,\"y\":%.2f,\"width\":%.2f,\"height\":%.2f}",
        (double)bounds.origin.x, (double)bounds.origin.y,
        (double)bounds.size.width, (double)bounds.size.height);
  } else {
    g_string_append(out, ",\"bounds\":null");
  }

  g_string_append(out, ",\"halign\":");
  json_string(out, align_nick(gtk_widget_get_halign(widget)));
  g_string_append(out, ",\"valign\":");
  json_string(out, align_nick(gtk_widget_get_valign(widget)));

  g_string_append_printf(out, ",\"hexpand\":%s,\"vexpand\":%s,\"hexpandSet\":%s,\"vexpandSet\":%s",
                         gtk_widget_get_hexpand(widget) ? "true" : "false",
                         gtk_widget_get_vexpand(widget) ? "true" : "false",
                         gtk_widget_get_hexpand_set(widget) ? "true" : "false",
                         gtk_widget_get_vexpand_set(widget) ? "true" : "false");

  g_string_append_printf(out, ",\"marginStart\":%d,\"marginEnd\":%d,\"marginTop\":%d,\"marginBottom\":%d",
                         gtk_widget_get_margin_start(widget),
                         gtk_widget_get_margin_end(widget),
                         gtk_widget_get_margin_top(widget),
                         gtk_widget_get_margin_bottom(widget));

  int width_request = -1, height_request = -1;
  gtk_widget_get_size_request(widget, &width_request, &height_request);
  g_string_append_printf(out, ",\"widthRequest\":%d,\"heightRequest\":%d",
                         width_request, height_request);

  g_string_append(out, ",\"cssClasses\":[");
  char **css_classes = gtk_widget_get_css_classes(widget);
  if (css_classes != NULL) {
    for (guint i = 0; css_classes[i] != NULL; i++) {
      if (i > 0) g_string_append_c(out, ',');
      json_string(out, css_classes[i]);
    }
    g_strfreev(css_classes);
  }
  g_string_append_c(out, ']');

  /* GtkStack and AdwViewStack both expose a string "visible-child-name"
   * property. Property lookup avoids linking libadwaita. */
  g_string_append(out, ",\"visibleChildName\":");
  GParamSpec *pspec = g_object_class_find_property(G_OBJECT_GET_CLASS(widget),
                                                   "visible-child-name");
  if (pspec != NULL && pspec->value_type == G_TYPE_STRING &&
      (pspec->flags & G_PARAM_READABLE)) {
    char *name = NULL;
    g_object_get(widget, "visible-child-name", &name, NULL);
    json_string(out, name);
    g_free(name);
  } else {
    g_string_append(out, "null");
  }

  g_string_append_c(out, '}');
}

static void walk_widget(GString *out, GtkWidget *widget, GtkWidget *toplevel,
                        GArray *index_path, gboolean *first) {
  append_widget(out, widget, toplevel, index_path, first);
  int child_index = 0;
  for (GtkWidget *child = gtk_widget_get_first_child(widget); child != NULL;
       child = gtk_widget_get_next_sibling(child), child_index++) {
    g_array_append_val(index_path, child_index);
    walk_widget(out, child, toplevel, index_path, first);
    g_array_remove_index(index_path, index_path->len - 1);
  }
}

static void write_probe_output(void) {
  const char *output_path = g_getenv("PROBE_OUTPUT");
  if (output_path == NULL || output_path[0] == '\0') return;

  GString *out = g_string_new(NULL);
  g_string_append_printf(out, "{\n  \"probeVersion\": %d,\n  \"app\": ", PROBE_VERSION);
  json_string(out, g_get_prgname());
  g_string_append_printf(out, ",\n  \"settleTicks\": %d,\n  \"widgets\": [",
                         settle_ticks_target());

  gboolean first = TRUE;
  GListModel *toplevels = gtk_window_get_toplevels();
  guint toplevel_count = g_list_model_get_n_items(toplevels);
  for (guint i = 0; i < toplevel_count; i++) {
    GtkWidget *toplevel = GTK_WIDGET(g_list_model_get_item(toplevels, i));
    GArray *index_path = g_array_new(FALSE, FALSE, sizeof(int));
    int toplevel_index = (int)i;
    g_array_append_val(index_path, toplevel_index);
    walk_widget(out, toplevel, toplevel, index_path, &first);
    g_array_free(index_path, TRUE);
    g_object_unref(toplevel);
  }
  g_string_append(out, "\n  ]\n}\n");

  /* Atomic publish: write a sibling tmp file, then rename over the target,
   * so the host-side matcher never reads a truncated document. */
  char *tmp_path = g_strconcat(output_path, ".tmp", NULL);
  GError *error = NULL;
  if (!g_file_set_contents(tmp_path, out->str, (gssize)out->len, &error)) {
    fprintf(stderr, "protota-probe: cannot write %s: %s\n", tmp_path,
            error != NULL ? error->message : "unknown error");
    g_clear_error(&error);
  } else if (g_rename(tmp_path, output_path) != 0) {
    fprintf(stderr, "protota-probe: cannot rename %s -> %s\n", tmp_path, output_path);
  } else {
    fprintf(stderr, "protota-probe: wrote %s\n", output_path);
  }
  g_free(tmp_path);
  g_string_free(out, TRUE);
}

/* ---------- stability criterion (main thread) ---------------------------- */

typedef struct {
  double last_width;
  double last_height;
  int stable_ticks;
} ProbeSettleState;

/* Frame-clock tick on the mapped toplevel: N consecutive ticks with no
 * toplevel allocation change = "first stable mapped frame" (mirrors the
 * capture's data-protota-ready settle logic). */
static gboolean on_frame_tick(GtkWidget *toplevel, GdkFrameClock *frame_clock,
                              gpointer user_data) {
  (void)frame_clock;
  ProbeSettleState *state = user_data;
  double width = (double)gtk_widget_get_width(toplevel);
  double height = (double)gtk_widget_get_height(toplevel);
  if (width == state->last_width && height == state->last_height &&
      gtk_widget_get_mapped(toplevel)) {
    state->stable_ticks++;
  } else {
    state->stable_ticks = 0;
    state->last_width = width;
    state->last_height = height;
  }
  if (state->stable_ticks >= settle_ticks_target()) {
    write_probe_output();
    g_free(state);
    return G_SOURCE_REMOVE;
  }
  return G_SOURCE_CONTINUE;
}

/* Runs on the main loop every 100ms until a mapped toplevel exists, then
 * arms the frame-clock settle watch on it. */
static gboolean arm_probe(gpointer user_data) {
  (void)user_data;
  GListModel *toplevels = gtk_window_get_toplevels();
  guint count = g_list_model_get_n_items(toplevels);
  for (guint i = 0; i < count; i++) {
    GtkWidget *toplevel = GTK_WIDGET(g_list_model_get_item(toplevels, i));
    gboolean mapped = gtk_widget_get_mapped(toplevel);
    if (mapped) {
      ProbeSettleState *state = g_new0(ProbeSettleState, 1);
      state->last_width = -1.0;
      state->last_height = -1.0;
      /* Tick callbacks drive the widget's frame clock, so the settle count
       * advances even when the app requests no further frames itself. */
      gtk_widget_add_tick_callback(toplevel, on_frame_tick, state, NULL);
      g_object_unref(toplevel);
      return G_SOURCE_REMOVE;
    }
    g_object_unref(toplevel);
  }
  return G_SOURCE_CONTINUE; /* keep polling for a mapped toplevel */
}

static gboolean schedule_arm_timer(gpointer user_data) {
  (void)user_data;
  /* Now on the main thread: poll for a mapped toplevel at timer pace
   * instead of busy-spinning the idle queue. */
  g_timeout_add(100, arm_probe, NULL);
  return G_SOURCE_REMOVE;
}

/* ---------- injection (constructor thread) ------------------------------- */

static void *wait_for_display(void *user_data) {
  (void)user_data;
  /* LD_PRELOAD constructors run before gtk_init; never assume init order.
   * Poll from a plain thread, then hand off to the GTK main loop with
   * g_idle_add — the only thread-safe entry point. If the process never
   * becomes a GTK app this thread polls forever and the capture proceeds
   * probe-less (containment rule). */
  while (gdk_display_get_default() == NULL) {
    g_usleep(50 * 1000);
  }
  g_idle_add(schedule_arm_timer, NULL);
  return NULL;
}

__attribute__((constructor)) static void probe_init(void) {
  const char *output_path = getenv("PROBE_OUTPUT");
  if (output_path == NULL || output_path[0] == '\0') return; /* fully inert */
  pthread_t thread;
  if (pthread_create(&thread, NULL, wait_for_display, NULL) == 0) {
    pthread_detach(thread);
  }
}
