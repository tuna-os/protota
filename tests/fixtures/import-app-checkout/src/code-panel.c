G_DEFINE_TYPE (CodePanel, code_panel, GTK_TYPE_BOX);

static void
code_panel_init (CodePanel *self)
{
  GtkWidget *from_code = gtk_button_new ();
  gtk_button_set_label (GTK_BUTTON (from_code), "From C adapter");
  gtk_box_append (GTK_BOX (self), from_code);
}
