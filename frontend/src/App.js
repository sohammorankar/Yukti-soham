import "@/index.css";
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

import SiteLayout from "@/components/site/SiteLayout";
import { HomeStartupGate } from "@/components/site/HomeStartupGate";
import Home from "@/pages/Home";
import StoreDirectory from "@/pages/StoreDirectory";
import StorePage from "@/pages/StorePage";
import CategoryPage from "@/pages/CategoryPage";
import { About, Mission, HowItWorks, Privacy, Terms, AffiliateDisclosure, CashbackDisclaimer, CookiePolicy, FAQ } from "@/pages/content";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { Brands, Categories, Deals } from "@/pages/discovery";
import Bridge from "@/pages/Bridge";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import MyCards from "@/pages/MyCards";
import Profile from "@/pages/Profile";

import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Platforms from "@/pages/admin/Platforms";
import Stores from "@/pages/admin/Stores";
import HomepageCategories from "@/pages/admin/HomepageCategories";
import HomepagePromotions from "@/pages/admin/HomepagePromotions";
import CategoriesAdmin from "@/pages/admin/CategoriesAdmin";
import Rates from "@/pages/admin/Rates";
import Matrix from "@/pages/admin/Matrix";
import Audit from "@/pages/admin/Audit";
import CardCatalogue from "@/pages/admin/CardCatalogue";
import AffiliateDestinations from "@/pages/admin/AffiliateDestinations";
import UserFeedback from "@/pages/admin/UserFeedback";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <HomeStartupGate>
          <AuthProvider>
            <Routes>
            <Route element={<SiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/stores" element={<StoreDirectory />} />
              <Route path="/stores/:slug" element={<StorePage />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/brands" element={<Brands />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/about" element={<About />} />
              <Route path="/mission" element={<Mission />} />
              <Route path="/contact" element={<FeedbackPage kind="contact" />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/affiliate-disclosure" element={<AffiliateDisclosure />} />
              <Route path="/cashback-disclaimer" element={<CashbackDisclaimer />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/report-rate" element={<FeedbackPage kind="report_rate" />} />
              <Route path="/suggest" element={<FeedbackPage kind="suggest_store" />} />
              <Route path="/account/cards" element={<MyCards />} />
              <Route path="/account/profile" element={<Profile />} />
            </Route>

            <Route path="/go/:partner" element={<Bridge />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="platforms" element={<Platforms />} />
              <Route path="stores" element={<Stores />} />
              <Route path="homepage/categories" element={<HomepageCategories />} />
              <Route path="homepage/promotions" element={<HomepagePromotions />} />
              <Route path="categories" element={<CategoriesAdmin />} />
              <Route path="rates" element={<Rates />} />
              <Route path="matrix" element={<Matrix />} />
              <Route path="affiliate-destinations" element={<AffiliateDestinations />} />
              <Route path="cards" element={<CardCatalogue />} />
              <Route path="audit" element={<Audit />} />
              <Route path="user-feedback" element={<UserFeedback />} />
            </Route>
            </Routes>
            <Toaster position="top-center" richColors />
          </AuthProvider>
        </HomeStartupGate>
      </BrowserRouter>
    </ThemeProvider>
  );
}
